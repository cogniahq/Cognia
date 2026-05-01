# Memories

CRUD on the memory index.

## `GET /v1/memories`

Paginated chronological listing.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `cursor` | string | — | Opaque, comes from a prior response's `next_cursor` |
| `limit`  | int    | 50 | 1-200 |
| `q`      | string | —  | Substring filter on title + content (case-insensitive) |

**Required scope:** `memories.read`

**Response:**

```json
{
  "data": [
    {
      "id": "11ee6f8b-…",
      "title": "MSA — Acme Corp 2024",
      "content": "This Master Services Agreement…",
      "url": null,
      "memory_type": "DOCUMENT_CHUNK",
      "source": "document",
      "source_type": "DOCUMENT",
      "created_at": "2026-04-29T17:12:09Z"
    }
  ],
  "next_cursor": "eyJpZCI6IjE…"
}
```

`next_cursor` is `null` on the last page.

## `GET /v1/memories/:id`

Fetch a single memory.

**Required scope:** `memories.read`

**Response:** `{ "data": Memory }`

Returns `404` if the memory is not visible to the API key's user.

## `PATCH /v1/memories/:id`

Update mutable fields.

**Body:**

```json
{
  "title": "New title",         // optional
  "content": "New body",        // optional
  "url": "https://…",           // optional, can be null
  "memory_type": "KNOWLEDGE"    // optional
}
```

**Required scope:** `memories.write`

Only the fields you pass are updated. The server re-embeds and re-indexes the memory automatically when `content` or `title` changes.

## `DELETE /v1/memories/:id`

Soft-delete. The memory is hidden from search and listings immediately; Qdrant points are removed; the row is purged from Postgres after 30 days by the `trash-purge` worker.

**Required scope:** `memories.write`

**Response:** `204 No Content`

Idempotent — re-deleting an already-deleted memory returns `404`.
