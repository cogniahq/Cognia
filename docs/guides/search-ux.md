# Search-driven UX

Patterns for shipping high-quality search-as-you-type and command-K experiences with `@cogniahq/sdk`.

## Pattern 1: Debounced search-as-you-type

Don't fire one request per keystroke. Debounce 250ms, then call:

```ts
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: import.meta.env.VITE_COGNIA_API_KEY })

let activeController: AbortController | null = null

async function onInput(query: string) {
  activeController?.abort()
  if (!query.trim()) return

  const controller = new AbortController()
  activeController = controller

  try {
    const hits = await cognia.search.query({ query, limit: 8 })
    if (!controller.signal.aborted) renderHits(hits)
  } catch (error) {
    if (controller.signal.aborted) return  // user kept typing
    showError(error)
  }
}
```

::: warning
Don't expose API keys to the browser. In production, proxy through your own server endpoint that holds the key.
:::

## Pattern 2: Cmd-K palette

Combine `cognia.search.query` with `cognia.memories.list` for "recent + semantic" results:

```ts
async function paletteResults(query: string) {
  if (!query.trim()) {
    // No query yet → show recent
    const page = await cognia.memories.list({ limit: 10 })
    return page.data
  }
  // Query → semantic search
  return cognia.search.query({ query, limit: 10 })
}
```

## Pattern 3: Group hits by document

For document-heavy tenants, group multiple hits from the same source:

```ts
const hits = await cognia.search.query({ query, limit: 30 })

const grouped = new Map<string, typeof hits>()
for (const hit of hits) {
  const key = hit.document?.id ?? `memory:${hit.id}`
  if (!grouped.has(key)) grouped.set(key, [])
  grouped.get(key)!.push(hit)
}

// Render one entry per document, with N matching pages underneath
for (const [docKey, docHits] of grouped) {
  // …
}
```

## Pattern 4: RAG with citations

Pair the SDK with the LLM of your choice. Always ask for citations and pass them through:

```ts
const hits = await cognia.search.query({ query, limit: 8 })
const context = hits
  .map((hit, i) => `[${i + 1}] ${hit.title ?? 'memory'}\n${hit.snippet}`)
  .join('\n\n')

const prompt = `Answer using ONLY the citations. Cite as [1], [2].

Citations:
${context}

Question: ${query}`
```

When the LLM responds with `…increased rev by 18% [3]`, you have hit `hits[2]` to display in the UI.

## Don't fight the ranking

Cognia's reranker is a strong judge of relevance. Avoid client-side re-sorting (alphabetical, by date, by source) on the same result set — you'll lose the cross-encoder's signal.

If the user asks for "newest first," issue a separate `cognia.memories.list` call. If they ask for "most relevant," use search.

## Empty states

When `hits.length === 0`, three things to consider:

1. **Show why** — "No memories match 'x'. Try a broader query."
2. **Suggest fallbacks** — recent memories, popular searches, or "ask the AI directly."
3. **Don't auto-call the LLM** — generating an answer from zero context produces hallucinations. Better to say "I don't have any record of that."
