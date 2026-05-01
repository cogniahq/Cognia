import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { CogniaClient, CogniaApiError } from '@cogniahq/sdk'

export interface CogniaMcpOptions {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
}

const SEARCH_TOOL = {
  name: 'cognia_search',
  description:
    "Hybrid (dense + sparse BM25) search across the user's Cognia memories with cross-encoder reranking. Use this whenever the user asks about anything in their workspace, documents, or browsing history.",
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The natural-language search query.',
      },
      limit: {
        type: 'integer',
        description: 'Max results to return (1-50). Default 10.',
        minimum: 1,
        maximum: 50,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
}

const GET_MEMORY_TOOL = {
  name: 'cognia_get_memory',
  description: 'Fetch the full content of a single memory by id. Use after cognia_search when you need more than the snippet.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'The memory id (uuid).' },
    },
    required: ['id'],
    additionalProperties: false,
  },
}

const LIST_MEMORIES_TOOL = {
  name: 'cognia_list_memories',
  description:
    'Paginated chronological listing of memories. Useful for browsing recent activity. Use cognia_search for semantic queries.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      cursor: { type: 'string', description: 'Opaque pagination cursor from a prior response.' },
      limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Page size, default 50.' },
      q: {
        type: 'string',
        description: 'Optional substring filter on title / content (case-insensitive).',
      },
    },
    additionalProperties: false,
  },
}

interface SearchArgs {
  query: string
  limit?: number
}

interface GetMemoryArgs {
  id: string
}

interface ListMemoriesArgs {
  cursor?: string
  limit?: number
  q?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asSearchArgs(value: unknown): SearchArgs {
  if (!isObject(value) || typeof value.query !== 'string' || !value.query.trim()) {
    throw new Error('cognia_search requires a non-empty `query` string')
  }
  const out: SearchArgs = { query: value.query }
  if (typeof value.limit === 'number' && Number.isFinite(value.limit)) {
    out.limit = Math.min(50, Math.max(1, Math.floor(value.limit)))
  }
  return out
}

function asGetMemoryArgs(value: unknown): GetMemoryArgs {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error('cognia_get_memory requires an `id` string')
  }
  return { id: value.id }
}

function asListMemoriesArgs(value: unknown): ListMemoriesArgs {
  const out: ListMemoriesArgs = {}
  if (!isObject(value)) return out
  if (typeof value.cursor === 'string') out.cursor = value.cursor
  if (typeof value.q === 'string') out.q = value.q
  if (typeof value.limit === 'number' && Number.isFinite(value.limit)) {
    out.limit = Math.min(200, Math.max(1, Math.floor(value.limit)))
  }
  return out
}

function asTextResult(payload: unknown): {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
} {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

function asErrorResult(error: unknown): {
  content: Array<{ type: 'text'; text: string }>
  isError: true
} {
  let message = error instanceof Error ? error.message : String(error)
  if (error instanceof CogniaApiError) {
    message = `${error.code} (${error.status}): ${error.message}`
  }
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

export function createCogniaMcpServer(options: CogniaMcpOptions): Server {
  const client = new CogniaClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.cognia.xyz',
    timeoutMs: options.timeoutMs ?? 30_000,
    userAgent: 'cognia-mcp',
  })

  const server = new Server(
    { name: 'cognia-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [SEARCH_TOOL, GET_MEMORY_TOOL, LIST_MEMORIES_TOOL],
  }))

  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const { name, arguments: args } = request.params

      if (name === SEARCH_TOOL.name) {
        const parsed = asSearchArgs(args)
        const hits = await client.search.query({
          query: parsed.query,
          ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
        })
        return asTextResult({ hits })
      }

      if (name === GET_MEMORY_TOOL.name) {
        const parsed = asGetMemoryArgs(args)
        const memory = await client.memories.retrieve(parsed.id)
        return asTextResult({ memory })
      }

      if (name === LIST_MEMORIES_TOOL.name) {
        const parsed = asListMemoriesArgs(args)
        const page = await client.memories.list(parsed)
        return asTextResult({ memories: page.data, next_cursor: page.next_cursor })
      }

      return asErrorResult(new Error(`Unknown tool: ${name}`))
    } catch (error) {
      return asErrorResult(error)
    }
  })

  return server
}
