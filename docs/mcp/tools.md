# Tools reference

The Cognia MCP server registers three tools. The model decides when to call them based on the user's question; you don't write any glue.

## `cognia_search`

Hybrid (dense + BM25 sparse) search across the user's Cognia memories with cross-encoder reranking.

```jsonc
{
  "name": "cognia_search",
  "inputSchema": {
    "type": "object",
    "required": ["query"],
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "integer", "minimum": 1, "maximum": 50 }
    },
    "additionalProperties": false
  }
}
```

**Example call:**

```jsonc
{
  "name": "cognia_search",
  "arguments": { "query": "renewal terms in Acme MSA", "limit": 8 }
}
```

**Example response:**

```json
{
  "hits": [
    {
      "id": "11ee6f8b-…",
      "title": "MSA — Acme Corp 2024",
      "snippet": "Auto-renews for 12 months unless either party gives 60 days' notice…",
      "url": "https://cognia.xyz/memories/11ee6f8b",
      "score": 0.94,
      "document": {
        "id": "doc_…",
        "name": "ACME-MSA-2024.pdf",
        "page_number": 8
      }
    }
  ]
}
```

## `cognia_get_memory`

Fetch the full content of a single memory by id. Use this after `cognia_search` when the snippet isn't enough.

```jsonc
{
  "name": "cognia_get_memory",
  "inputSchema": {
    "type": "object",
    "required": ["id"],
    "properties": { "id": { "type": "string" } },
    "additionalProperties": false
  }
}
```

## `cognia_list_memories`

Paginated chronological listing — useful for browsing recent activity rather than searching.

```jsonc
{
  "name": "cognia_list_memories",
  "inputSchema": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string" },
      "limit":  { "type": "integer", "minimum": 1, "maximum": 200 },
      "q":      { "type": "string" }
    },
    "additionalProperties": false
  }
}
```

The `cursor` is opaque — pass back what you got in the prior response's `next_cursor`. Iterate until `next_cursor` is `null`.

## Error handling

Tool errors are returned as MCP `isError: true` results, not protocol-level errors. The error message includes the underlying Cognia error code and HTTP status:

```jsonc
{
  "isError": true,
  "content": [
    { "type": "text", "text": "forbidden (403): Missing scope: search" }
  ]
}
```

Models will typically retry with a fixed query or surface the error to the user.
