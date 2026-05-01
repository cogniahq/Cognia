#!/usr/bin/env node
/**
 * Cognia MCP — stdio entry point. Configure your MCP client (Claude Desktop,
 * Cursor, Cline, etc.) to launch this binary, passing your API key via env.
 *
 * Required env:
 *   COGNIA_API_KEY      — Cognia API key (ck_live_… or ck_test_…)
 *
 * Optional env:
 *   COGNIA_BASE_URL     — defaults to https://api.cognia.xyz
 *   COGNIA_TIMEOUT_MS   — per-request timeout, default 30000
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createCogniaMcpServer } from './server.js'

async function main(): Promise<void> {
  const apiKey = process.env.COGNIA_API_KEY
  if (!apiKey) {
    process.stderr.write(
      'cognia-mcp: COGNIA_API_KEY environment variable is required.\n' +
        'Generate one at https://cognia.xyz/settings/api-keys.\n'
    )
    process.exit(1)
  }

  const baseUrl = process.env.COGNIA_BASE_URL
  const timeoutMs = process.env.COGNIA_TIMEOUT_MS
    ? Number(process.env.COGNIA_TIMEOUT_MS)
    : undefined

  const server = createCogniaMcpServer({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  process.stderr.write('cognia-mcp: ready (stdio)\n')
}

main().catch(error => {
  process.stderr.write(
    `cognia-mcp: fatal: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
})
