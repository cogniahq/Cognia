# Programmatic embedding

If you're building your own MCP host (for example, a custom IDE plugin or Slack bot), you can mount the Cognia tools without going through the CLI.

## Stdio transport

```ts
import { createCogniaMcpServer } from '@cogniahq/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = createCogniaMcpServer({
  apiKey: process.env.COGNIA_API_KEY!,
})

await server.connect(new StdioServerTransport())
```

## In-memory transport (for tests or embedded use)

```ts
import { createCogniaMcpServer } from '@cogniahq/mcp'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

const [clientT, serverT] = InMemoryTransport.createLinkedPair()
const server = createCogniaMcpServer({ apiKey: 'ck_test_…' })
await server.connect(serverT)

// Now connect your test client to clientT and exercise the protocol.
```

## Custom base URL

Useful for self-hosted Cognia deployments or staging:

```ts
createCogniaMcpServer({
  apiKey: process.env.COGNIA_API_KEY!,
  baseUrl: 'https://api.staging.cognia.xyz',
  timeoutMs: 60_000,
})
```

## Composing with other servers

The factory returns a fully-formed `Server` from `@modelcontextprotocol/sdk`. You can register additional handlers on it before connecting a transport:

```ts
import {
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = createCogniaMcpServer({ apiKey })

// Wrap the existing tools/list handler with your own:
const original = (server as any)._requestHandlers.get('tools/list')
server.setRequestHandler(ListToolsRequestSchema, async req => {
  const result = await original(req)
  return { tools: [...result.tools, MY_EXTRA_TOOL] }
})

await server.connect(transport)
```

## Why use the factory vs. forking?

The factory is a hard contract: every release of `@cogniahq/mcp` keeps the tool names, input schemas, and JSON shapes stable across minor versions. Forking the source means you have to track upstream changes manually — including the ones we ship for hybrid-search quality improvements.
