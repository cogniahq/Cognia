# `@cogniahq/mcp`

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the user's Cognia memories — hybrid search, retrieve, list — to any MCP-compatible client.

```sh
npx @cogniahq/mcp
```

## What you get

When you wire Cognia into Claude Desktop, Cursor, or Cline, the assistant gains three tools:

| Tool | Purpose |
|---|---|
| `cognia_search`        | Hybrid (dense + sparse BM25) search with cross-encoder rerank |
| `cognia_get_memory`    | Fetch a single memory's full body |
| `cognia_list_memories` | Paginated chronological listing |

The model decides when to call them based on the user's question — you don't write any glue.

## Pages

- [Claude Desktop](./claude-desktop)
- [Cursor](./cursor)
- [Cline / Continue](./cline)
- [Tools reference](./tools)
- [Programmatic embedding](./programmatic)

## Architecture

```
┌────────────┐     stdio JSON-RPC     ┌────────────┐    HTTPS    ┌─────────────┐
│ MCP client │ ◄────────────────────► │ cognia-mcp │ ◄─────────► │ Cognia API  │
│ (Claude /  │                        │ (this pkg) │             │ (hybrid     │
│  Cursor /  │                        │            │             │  retrieval) │
│  Cline)    │                        └────────────┘             └─────────────┘
└────────────┘
```

The server itself is stateless; it shells out to the [Cognia SDK](../sdk/) on each call. Latency is dominated by the upstream search call (~200-400ms p50).

## Why MCP?

- **One config, every tool.** Same `cognia` namespace across Claude, Cursor, Cline, Continue, Zed.
- **Native UX.** Models call tools without prompting boilerplate. Sources are surfaced as citations automatically by the host.
- **Permissioned.** API key scopes the server can do exactly what your key allows — no more.
