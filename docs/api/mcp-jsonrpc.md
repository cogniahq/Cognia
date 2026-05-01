# MCP / JSON-RPC

For programmatic clients that don't want to spawn a stdio server, Cognia exposes the same MCP tools over HTTP at `POST /mcp/v1/jsonrpc`.

This is JSON-RPC 2.0 — same shape MCP clients use, just over HTTP instead of stdio.

## Request shape

```http
POST /mcp/v1/jsonrpc HTTP/1.1
Authorization: Bearer ck_live_…
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cognia.search",
    "arguments": { "query": "force majeure", "limit": 5 }
  }
}
```

## Methods

| Method | Notes |
|---|---|
| `initialize`  | Returns `protocolVersion`, capabilities, and server info |
| `tools/list`  | Returns the tool catalog (same as the stdio server) |
| `tools/call`  | Invokes a tool — see below |

## Tools

The HTTP transport uses dot-namespaced names (`cognia.search`) where the stdio server uses underscores (`cognia_search`) — a quirk of the underlying spec versions. Inputs are otherwise identical.

| HTTP name | Stdio name | Required scope |
|---|---|---|
| `cognia.search`        | `cognia_search`        | `search` |
| `cognia.get_memory`    | `cognia_get_memory`    | `memories.read` |
| `cognia.list_memories` | `cognia_list_memories` | `memories.read` |

## Response shape

Tool results are wrapped in an MCP-compatible content envelope:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"id\":\"11ee…\",\"title\":\"MSA…\",\"snippet\":\"Auto-renews…\"}]"
      }
    ]
  }
}
```

The `text` is JSON itself — parse it on the client side. This double-encoding is mandated by the MCP spec for forward compatibility with mixed-modality content.

## Errors

JSON-RPC errors use standard codes plus a Cognia-specific range starting at `-32000`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Unknown tool: cognia.foo"
  }
}
```

| Code | Meaning |
|---|---|
| `-32600` | Invalid Request |
| `-32601` | Method not found / unknown tool |
| `-32602` | Invalid params |
| `-32000` | Server-side error (tool execution failure) |
