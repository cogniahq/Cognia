# Reranking

The first stage (hybrid retrieval) gives us 200 candidates ordered by RRF. The second stage shrinks 200 → 10 with a **cross-encoder reranker**.

## Why cross-encoder?

Bi-encoders (the dense embedding model) compute query and document vectors **independently** and compare with cosine. Fast at search time, but the model never sees query + document **together**.

Cross-encoders take `[query, document]` as a single input and output a relevance score. This catches subtleties — negation, scope, exact-vs-paraphrase — that bi-encoders smooth away.

Trade-off: latency. A bi-encoder ANN over 1M vectors takes ~25ms. A cross-encoder over 50 candidates takes ~110ms. So we use bi-encoder + sparse for the wide net (1M → 200), then cross-encoder for the precise sort (200 → 50 → 10).

## Provider abstraction

Rather than lock to one vendor, Cognia ships a small abstraction:

```ts
// src/services/search/rerank-provider.service.ts
type Provider = 'cohere' | 'voyage' | 'jina' | 'passthrough'
```

Provider order is auto-detected from environment variables:

```sh
COHERE_API_KEY=…    # → cohere (default if set)
VOYAGE_API_KEY=…    # → voyage  (fallback if cohere fails)
JINA_API_KEY=…      # → jina    (fallback if both fail)
                    # → passthrough  (last resort)
```

Or pinned explicitly:

```sh
RERANK_PROVIDER=voyage
```

| Provider | Model | Strengths | Notes |
|---|---|---|---|
| Cohere       | `rerank-v3.5`               | Highest quality across most domains; native multilingual | Default |
| Voyage       | `rerank-2`                  | Strong on technical & code corpora                      | Good for engineering teams |
| Jina         | `jina-reranker-v2-base-multilingual` | OSS-friendly, lower cost                          | Useful for self-hosted setups |
| Passthrough  | —                           | Returns RRF ordering unchanged                          | Local dev / no API budget |

## Cohere rerank flow

```
candidate texts:  [text1, text2, … text50]    query: "force majeure carve-outs"
                                │
                                ▼
                  POST https://api.cohere.com/v2/rerank
                  { model, query, documents, top_n }
                                │
                                ▼
                  [{index, relevance_score}, …]   sorted desc
                                │
                                ▼
            mapped back to memory_id, score normalized to [0, 1]
```

## Failure handling

If Cohere returns 5xx or times out (`RERANK_TIMEOUT_MS`, default 15s), the provider chain falls through to the next configured provider, then to passthrough. The user sees results either way — slightly worse ordering on the rare upstream outage, never a failed request.

## Cache

Reranker outputs are not cached separately. They flow into the **query cache** (Redis, 60s TTL) keyed by `(org, query, filters)` — the entire fused-and-reranked top-N is one cache entry.

## What we don't do

- **No LLM-as-reranker.** Asking GPT-4 / Claude Sonnet to JSON-rank 50 candidates costs 10-20× more, takes 2-4× longer, and scores worse on standard benchmarks (MS MARCO, BEIR) than dedicated rerankers.
- **No fine-tuning on user data.** Reranking is fully zero-shot. If a tenant wants domain-tuned rerank, we can swap to a self-hosted model behind the same provider interface — but that's an enterprise-tier feature, not the default.
