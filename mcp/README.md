# @cogniahq/mcp

Cognia [Model Context Protocol](https://modelcontextprotocol.io) server. Exposes the user's Cognia memories — hybrid-search, retrieve, list — to any MCP-compatible client (Claude Desktop, Cursor, Cline, Continue, Zed, etc.).

## Quick install

```sh
npm install -g @cogniahq/mcp
```

…or skip the install and let `npx` fetch it on first run via the client config.

## Tools exposed

| Tool | Purpose |
|---|---|
| `cognia_search`        | Hybrid (dense + BM25 sparse) search with cross-encoder reranking. |
| `cognia_get_memory`    | Fetch the full body of one memory by id. |
| `cognia_list_memories` | Paginated chronological listing (with optional substring filter). |

The server uses your **API key**, not a session — so it works in headless / non-browser MCP hosts.

## Get an API key

1. Sign in at https://cognia.xyz
2. **Settings → API keys → Create key**
3. Choose scopes:
   - `search` — required for `cognia_search`
   - `memories.read` — required for `cognia_get_memory` and `cognia_list_memories`
   - (or `*` for all scopes)
4. Copy the key (starts with `ck_live_…`).

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```jsonc
{
  "mcpServers": {
    "cognia": {
      "command": "npx",
      "args": ["-y", "@cogniahq/mcp"],
      "env": {
        "COGNIA_API_KEY": "ck_live_…"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the tools listed in the MCP indicator on the bottom-right of the prompt.

## Cursor

Open **Settings → MCP → Add new MCP server**. Paste:

```json
{
  "name": "cognia",
  "command": "npx",
  "args": ["-y", "@cogniahq/mcp"],
  "env": {
    "COGNIA_API_KEY": "ck_live_…"
  }
}
```

## Cline / Continue

Add to `~/.cline/mcp_settings.json` (or the equivalent for Continue):

```json
{
  "mcpServers": {
    "cognia": {
      "command": "npx",
      "args": ["-y", "@cogniahq/mcp"],
      "env": { "COGNIA_API_KEY": "ck_live_…" }
    }
  }
}
```

## Self-hosted / staging

Point at a different deployment with `COGNIA_BASE_URL`:

```json
"env": {
  "COGNIA_API_KEY": "ck_live_…",
  "COGNIA_BASE_URL": "https://api.staging.cognia.xyz"
}
```

## Programmatic use

```ts
import { createCogniaMcpServer } from '@cogniahq/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = createCogniaMcpServer({ apiKey: process.env.COGNIA_API_KEY! })
await server.connect(new StdioServerTransport())
```

## Troubleshooting

**`COGNIA_API_KEY environment variable is required.`** — Set the env var in your client's MCP config (see above), not in your shell.

**Tools call returns `forbidden (403)`** — Your API key doesn't have the required scope. Edit the key to add `search` / `memories.read`.

**Tool call returns `unauthorized (401)`** — The key is revoked or wrong. Generate a new key.

## License

Apache-2.0
