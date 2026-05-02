/**
 * Model Context Protocol (MCP) HTTP server.
 *
 * Implements a minimal subset of the MCP spec
 * (https://modelcontextprotocol.io) over JSON-RPC 2.0 + HTTP, authenticated
 * via Cognia API keys. Exposes three tools backed by the user's memory store:
 *   - cognia_search        : full-text search across user memories
 *   - cognia_get_memory    : fetch a single memory by id
 *   - cognia_list_memories : paginated listing
 *
 * Tool names use snake_case to align with the standalone @cogniahq/mcp server
 * and the public docs. The legacy dotted form (cognia.search, etc.) is still
 * accepted by tools/call for back-compat with in-flight integrations and is
 * planned to be removed in a future release.
 *
 * The transport is HTTP POST so the same endpoint serves all JSON-RPC methods.
 */
import { Router, Response } from 'express'
import { authenticateApiKey, ApiKeyRequest } from '../middleware/api-key.middleware'
import { listMemories } from '../services/memory/memory-crud.service'
import { unifiedSearchService } from '../services/search/unified-search.service'
import { prisma } from '../lib/prisma.lib'

const router = Router()

router.use('/v1', authenticateApiKey)

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: Record<string, unknown>
}

interface ToolCallParams {
  name: string
  arguments?: Record<string, unknown>
}

router.post('/v1/jsonrpc', async (req: ApiKeyRequest, res: Response) => {
  const body = req.body as JsonRpcRequest
  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    return res.json({
      jsonrpc: '2.0',
      id: body?.id ?? null,
      error: { code: -32600, message: 'Invalid request' },
    })
  }

  if (body.method === 'initialize') {
    return res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'cognia-mcp', version: '1.0.0' },
      },
    })
  }

  if (body.method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        tools: [
          {
            name: 'cognia_search',
            description: "Search the user's memories by query string.",
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                limit: { type: 'integer' },
              },
              required: ['query'],
            },
          },
          {
            name: 'cognia_get_memory',
            description: 'Fetch a single memory by id.',
            inputSchema: {
              type: 'object',
              properties: { id: { type: 'string' } },
              required: ['id'],
            },
          },
          {
            name: 'cognia_list_memories',
            description: 'List recent memories (paginated, opaque cursor).',
            inputSchema: {
              type: 'object',
              properties: {
                cursor: { type: 'string' },
                limit: { type: 'integer' },
              },
            },
          },
        ],
      },
    })
  }

  if (body.method === 'tools/call') {
    const userId = req.apiKey!.userId
    const params = (body.params ?? {}) as unknown as ToolCallParams
    const { name, arguments: args } = params
    // Accept both snake_case (canonical, what tools/list returns) and the legacy
    // dotted form for back-compat. Normalise once so the switch below is simple.
    const canonicalName =
      name === 'cognia.search'
        ? 'cognia_search'
        : name === 'cognia.get_memory'
          ? 'cognia_get_memory'
          : name === 'cognia.list_memories'
            ? 'cognia_list_memories'
            : name
    try {
      let resultPayload: unknown
      if (canonicalName === 'cognia_search') {
        const query = String(args?.query ?? '')
        const limit = Math.min(Number(args?.limit ?? 10), 50)
        const organizationId = req.apiKey!.organizationId

        if (organizationId) {
          const search = await unifiedSearchService.search({
            organizationId,
            query,
            limit,
            includeAnswer: false,
            userId,
          })
          resultPayload = search.results.map(result => ({
            id: result.memoryId,
            title: result.title,
            snippet: result.contentPreview,
            url: result.url,
            score: result.score,
            documentId: result.documentId,
            documentName: result.documentName,
            pageNumber: result.pageNumber,
          }))
        } else {
          // Personal API key without org context — fall back to user-scoped memory listing
          const items = await prisma.memory.findMany({
            where: {
              user_id: userId,
              deleted_at: null,
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: limit,
            orderBy: { created_at: 'desc' },
          })
          resultPayload = items.map(m => ({
            id: m.id,
            title: m.title,
            snippet: m.content?.slice(0, 200),
            url: m.url,
          }))
        }
      } else if (canonicalName === 'cognia_get_memory') {
        const m = await prisma.memory.findFirst({
          where: { id: String(args?.id ?? ''), user_id: userId, deleted_at: null },
        })
        resultPayload = m ?? null
      } else if (canonicalName === 'cognia_list_memories') {
        const out = await listMemories({
          userId,
          limit: Number(args?.limit ?? 50),
          cursor: typeof args?.cursor === 'string' ? args.cursor : undefined,
        })
        resultPayload = { items: out.items, next_cursor: out.nextCursor }
      } else {
        return res.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        })
      }
      return res.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                resultPayload,
                (_k, v) => (typeof v === 'bigint' ? v.toString() : v) as unknown
              ),
            },
          ],
        },
      })
    } catch (err) {
      return res.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: (err as Error).message },
      })
    }
  }

  return res.json({
    jsonrpc: '2.0',
    id: body.id,
    error: { code: -32601, message: `Unknown method: ${body.method}` },
  })
})

export default router
