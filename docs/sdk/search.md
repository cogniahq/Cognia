# Search

Hybrid retrieval over the API key's tenant. See [architecture](../architecture/retrieval) for what runs server-side.

## `cognia.search.query(options)`

```ts
const hits = await cognia.search.query({
  query: 'force majeure carve-outs we negotiated last year',
  limit: 10,    // 1-50, default 10
})
```

Returns `SearchHit[]` ordered by descending relevance.

### `SearchHit` shape

```ts
interface SearchHit {
  id: string                 // memory id (uuid)
  title: string | null
  snippet: string            // ~300-char preview
  url: string | null
  score?: number             // post-rerank, higher = more relevant
  document?: {
    id?: string              // document id (if memory came from an upload)
    name?: string            // original filename
    page_number?: number     // 1-indexed page
  }
}
```

### Relevance signals

The score is the cross-encoder relevance from Cohere / Voyage / Jina (depending on tenant config), normalized to `[0, 1]`. It's **not** a probability — only the **ordering** is meaningful. Don't apply a static threshold; use top-N.

When no reranker is configured, the score is the RRF-fused dense + sparse rank reciprocal — also relative.

## Query writing tips

- **Phrase like a user.** "What did we negotiate about indemnity in the Acme contract?" beats "indemnity acme".
- **Add scope words.** Domain words like "MSA", "contract", "PR", "doc" help the BM25 leg pin down the right corner of the index.
- **Don't quote.** Quotes are passed verbatim to the BM25 tokenizer; they don't enable phrase search.
- **Exact identifiers work.** Citation numbers (`§14.3`, `RFC 7230`, `Issue #4421`) survive tokenization and rank well.

## Filters

The current SDK exposes the raw query knob. To filter by document type, matter, or metadata, drop down to the [REST API](../api/search) — the SDK will surface these in 0.2.

## Pagination

Search is **not** paginated. The cap is 50 hits per call. If you need more, narrow the query — Cognia's reranker doesn't gain quality past ~50 candidates, so deeper paging would mean weaker results, not more.
