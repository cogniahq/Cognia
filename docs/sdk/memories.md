# Memories

CRUD operations on the memory index.

## `cognia.memories.list(options?)`

Paginated chronological listing.

```ts
const page = await cognia.memories.list({
  limit: 50,        // 1-200, default 50
  cursor: undefined, // opaque, comes from a prior response
  q: 'invoice',     // optional substring filter (title + content)
})

console.log(page.data, page.next_cursor)
```

`next_cursor` is `null` on the last page.

## `cognia.memories.iterate(options?)`

Async iterator that walks every page lazily. Convenient for backfills:

```ts
let count = 0
for await (const memory of cognia.memories.iterate({ q: 'invoice' })) {
  count++
  if (count >= 1_000) break
}
```

The iterator advances by one page per `await`, so memory pressure stays bounded.

## `cognia.memories.retrieve(id)`

```ts
const memory = await cognia.memories.retrieve('11ee6f8b-…')
```

Returns the full memory object (title, content, url, source_type, created_at). Throws `CogniaApiError` with `status: 404` if the id is unknown or not visible to the API key's user.

## `cognia.memories.update(id, input)`

```ts
const updated = await cognia.memories.update('11ee6f8b-…', {
  title: 'Renamed',
  content: 'New body',
})
```

Only the fields you pass are updated. Returns the new memory object.

## `cognia.memories.delete(id)`

Soft-delete. The memory is hidden from search and listings immediately; Qdrant points are removed; the row is purged from Postgres after 30 days by the `trash-purge` worker.

```ts
await cognia.memories.delete('11ee6f8b-…')
```

Returns `void`. Idempotent — calling delete on an already-deleted memory returns `404`, which the SDK converts to a thrown `CogniaApiError`.
