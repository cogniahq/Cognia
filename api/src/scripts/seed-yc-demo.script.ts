import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'

const ORG_SLUG = 'blit-labs'
const ORG_NAME = 'Blit Labs'
const PASSWORD = 'DemoPassword2026!'

const USERS = {
  alex: { email: 'alex@blitlabs.com', name: 'Alex Chen' },
  sarah: { email: 'sarah@blitlabs.com', name: 'Sarah Patel' },
  bob: { email: 'bob@blitlabs.com', name: 'Bob Kim' },
}

type Owner = 'alex' | 'sarah' | 'bob'

interface MemorySeed {
  owner: Owner
  title: string
  content: string
  topics: string[]
  daysAgo: number
}

// Hero cluster — the demo query "Why did we pick Qdrant over Pinecone?"
const VECTOR_DB: MemorySeed[] = [
  {
    owner: 'sarah',
    title: 'Pinecone pricing analysis',
    content:
      'Pinecone Starter is $70/mo for one s1 pod (~100k vectors @ 1536 dims). Multi-region replication is enterprise-only. No community edition. Bills per pod-hour, not per query. For our scale projection (1M vectors by end of year), we are looking at $560/mo on starter pods or moving to s2/p2 which doubles costs. Pricing predictability is a concern.',
    topics: ['vector-db', 'pinecone', 'pricing', 'cost-analysis'],
    daysAgo: 21,
  },
  {
    owner: 'sarah',
    title: 'Qdrant benchmark on filtered queries',
    content:
      "Ran 50k filtered queries on identical 100k-vector dataset. Qdrant: p50 12ms, p99 38ms. Pinecone: p50 47ms, p99 180ms. Payload-heavy filtering is Qdrant's strength — its inverted index over metadata is faster than Pinecone's metadata filtering at high cardinality. For our memory retrieval workload (every query has user/org/workspace filters), Qdrant wins decisively.",
    topics: ['vector-db', 'qdrant', 'pinecone', 'benchmark', 'performance'],
    daysAgo: 18,
  },
  {
    owner: 'sarah',
    title: 'Weaviate hybrid search built-in',
    content:
      'Weaviate ships BM25 + vector hybrid out of the box. Pinecone needs Pinecone Inference plus client-side fusion. Qdrant supports sparse vectors so hybrid is doable but requires more glue code. We need hybrid for our dense+sparse memory retrieval — the dense embeddings miss exact-keyword matches that BM25 catches.',
    topics: ['vector-db', 'weaviate', 'hybrid-search', 'rag'],
    daysAgo: 16,
  },
  {
    owner: 'bob',
    title: 'Qdrant Docker footprint',
    content:
      'Qdrant runs in a single container, 80MB image. We can self-host on a t4g.small (2 vCPU, 2GB RAM). No external dependencies — just storage. Pinecone is hosted-only. For our self-hosted enterprise tier this is non-negotiable. Tested under docker compose with Postgres + Redis + Qdrant; whole stack boots in 4 seconds.',
    topics: ['vector-db', 'qdrant', 'docker', 'self-hosting', 'devops'],
    daysAgo: 14,
  },
  {
    owner: 'bob',
    title: 'Migration POC: Pinecone to Qdrant',
    content:
      "Re-indexed 50k vectors from Pinecone to Qdrant in 2 hours. Used pinecone-export-cli plus a custom batch-upsert script (256 vectors per batch). Schema mapping was straightforward — Pinecone metadata maps 1:1 to Qdrant payload. Zero data loss. The only friction was Pinecone's 10MB query response cap on large fetches, solved with pagination.",
    topics: ['vector-db', 'qdrant', 'pinecone', 'migration', 'tooling'],
    daysAgo: 12,
  },
  {
    owner: 'bob',
    title: 'Qdrant licensing review',
    content:
      'Apache 2.0. Cloud version available but optional. Eliminates the vendor lock-in concern that came up in our procurement review with Acme. Code is auditable. We can fork if needed. Pinecone is closed-source — we have no recourse if their pricing changes or they get acquired.',
    topics: ['vector-db', 'qdrant', 'licensing', 'compliance', 'risk'],
    daysAgo: 11,
  },
  {
    owner: 'alex',
    title: 'Decision: Qdrant. Rationale doc',
    content:
      "Picked Qdrant over Pinecone. Reasons: (1) self-hosting matches our enterprise data residency story, (2) Apache license eliminates vendor risk, (3) Sarah's benchmarks show 4x perf on payload-heavy queries, (4) Bob's POC proved migration works. Risk: smaller community than Pinecone, narrower ecosystem of integrations. Mitigation: stay on stable releases, contribute back to community.",
    topics: ['vector-db', 'qdrant', 'pinecone', 'decision', 'architecture'],
    daysAgo: 9,
  },
  {
    owner: 'alex',
    title: 'Acme procurement: EU data residency requirement',
    content:
      "Acme's procurement requires EU-only data storage. Qdrant self-host on Frankfurt resolves it. Pinecone EU was extra $200/mo and only US-EU multi-region on enterprise. This deal alone justifies Qdrant. Acme is a $40k ARR opportunity. We need to close them by Q2.",
    topics: ['vector-db', 'qdrant', 'data-residency', 'enterprise', 'sales'],
    daysAgo: 8,
  },
  {
    owner: 'alex',
    title: 'pgvector vs dedicated vector DB',
    content:
      "pgvector is fine for under 1M vectors. Above that the index rebuild times kill us — IVFFlat reindex on 5M vectors takes 40+ minutes. Qdrant's HNSW handles dynamic upserts without that pain. pgvector also lacks scalar quantization so memory cost is 4x higher per vector. Dedicated vector DB is the right call once we cross 500k vectors per tenant.",
    topics: ['vector-db', 'pgvector', 'qdrant', 'postgres', 'scaling'],
    daysAgo: 6,
  },
  {
    owner: 'sarah',
    title: 'Memory retrieval quality eval',
    content:
      'Recall@10 on our internal eval set (200 hand-labeled queries): Qdrant 0.91, Pinecone 0.88, Weaviate 0.89. Differences narrow when re-rankers are added (Cohere rerank-3 brings all three to 0.94+). Quality is essentially equivalent — choice is dominated by cost, residency, and operational concerns.',
    topics: ['vector-db', 'qdrant', 'pinecone', 'evaluation', 'rag', 'reranking'],
    daysAgo: 5,
  },
  {
    owner: 'bob',
    title: 'Qdrant scalar quantization',
    content:
      'Qdrant supports scalar quantization out-of-box: 4x memory reduction at less than 2% recall loss. Critical for keeping costs low at scale. Tested on our 100k-vector eval set: full-precision uses 600MB, int8 quantized uses 150MB, recall drops from 0.91 to 0.895. Acceptable trade-off.',
    topics: ['vector-db', 'qdrant', 'quantization', 'scaling', 'performance'],
    daysAgo: 4,
  },
  {
    owner: 'sarah',
    title: 'Pinecone serverless tier evaluation',
    content:
      'Pinecone serverless announced — pay per query, not per pod. Pricing is competitive ($0.40 per million reads) but cold-start latency is 200-500ms after idle. Not workable for our interactive search where users expect sub-second responses. Reconsider in 2026 when warm-pool features mature.',
    topics: ['vector-db', 'pinecone', 'serverless', 'pricing', 'latency'],
    daysAgo: 3,
  },
  {
    owner: 'alex',
    title: 'Vector DB stability evaluation plan',
    content:
      'Sticking with self-hosted Qdrant for first 6 months. Re-evaluate at 1M vectors per tenant or when Pinecone serverless cold-starts hit under 50ms. Quarterly review of: ops burden, recall quality, total cost of ownership. Decision owner: Alex. Stakeholders: Sarah (quality), Bob (ops).',
    topics: ['vector-db', 'qdrant', 'roadmap', 'evaluation'],
    daysAgo: 2,
  },
  {
    owner: 'bob',
    title: 'Qdrant operational notes',
    content:
      'Single-instance Qdrant takes 600MB RAM at 100k vectors with full-precision HNSW. Snapshot+restore tested: restore time about 2min for 100k vectors from S3. WAL gives durability without external dependencies. Backup script committed to ops repo. Monitoring: Prometheus exporter on /metrics, dashboard in Grafana.',
    topics: ['vector-db', 'qdrant', 'operations', 'observability', 'devops'],
    daysAgo: 1,
  },
  {
    owner: 'sarah',
    title: 'Embedding model: text-embedding-3-small vs Cohere v3',
    content:
      'text-embedding-3-small at 1536 dims gives best recall on our retrieval eval (0.91). Cohere embed-v3 is competitive (0.89) but adds another vendor. Stayed with OpenAI for now — simpler vendor surface, single billing relationship. Revisit when Cohere rerank+embed bundle pricing improves.',
    topics: ['vector-db', 'embeddings', 'openai', 'cohere', 'rag'],
    daysAgo: 1,
  },
]

const AI_LLM: MemorySeed[] = [
  {
    owner: 'sarah',
    title: 'GPT-4o vs Claude 3.5 Sonnet for synthesis',
    content:
      'Side-by-side on 50 synthesis prompts: Claude 3.5 wins on long-context fidelity (200k tokens vs 128k), GPT-4o wins on tool-calling reliability. We use both via AI Gateway: Claude for briefings, GPT-4o for structured outputs.',
    topics: ['ai', 'llm', 'gpt-4o', 'claude', 'evaluation'],
    daysAgo: 22,
  },
  {
    owner: 'sarah',
    title: 'Function calling reliability comparison',
    content:
      'GPT-4o function-call success rate: 96%. Claude tool_use success rate: 94%. Llama 3.1 70B via Together: 81%. We standardize on OpenAI tool format and translate at the edge.',
    topics: ['ai', 'llm', 'function-calling', 'tool-use'],
    daysAgo: 19,
  },
  {
    owner: 'alex',
    title: 'RAG vs fine-tuning for our use case',
    content:
      'For per-tenant memory retrieval, RAG wins decisively over fine-tuning: instant updates, no retraining, attribution preserved. Fine-tuning only useful for tone/style consistency, which we get for free from system prompts.',
    topics: ['ai', 'rag', 'fine-tuning', 'architecture'],
    daysAgo: 17,
  },
  {
    owner: 'bob',
    title: 'Streaming SSE setup for AI responses',
    content:
      'OpenAI SSE streaming via fetch with ReadableStream. Backpressure via abort controller. Client buffers tokens for smooth render. Edge: nginx default buffering blocks SSE — must set proxy_buffering off.',
    topics: ['ai', 'streaming', 'sse', 'backend'],
    daysAgo: 15,
  },
  {
    owner: 'sarah',
    title: 'Prompt caching savings',
    content:
      'Anthropic prompt caching cuts costs 80% for our system prompt + retrieved context pattern. Cache TTL is 5 min — long enough for follow-up turns. Implementation: mark system + retrieved context as cache breakpoints.',
    topics: ['ai', 'claude', 'prompt-caching', 'cost'],
    daysAgo: 13,
  },
  {
    owner: 'alex',
    title: 'Hallucination mitigation: forced citations',
    content:
      'Forced [n] citation tokens in answer reduces hallucination by 60%. Detect missing citations with regex post-process, retry with stricter prompt. Acceptable answer quality at 1 retry max.',
    topics: ['ai', 'rag', 'citations', 'quality'],
    daysAgo: 12,
  },
  {
    owner: 'sarah',
    title: 'Embeddings batch size sweet spot',
    content:
      'OpenAI embeddings: 256 inputs per batch is the throughput sweet spot. Beyond that, latency dominates. Below 64, per-request overhead dominates. We chunk capture-stream into 256-batch buffers.',
    topics: ['ai', 'embeddings', 'openai', 'performance'],
    daysAgo: 10,
  },
  {
    owner: 'bob',
    title: 'Token usage tracking for billing',
    content:
      'TokenUsage table records every LLM call: model, prompt tokens, completion tokens, user, org, operation. Aggregated nightly to UsageRecord for billing. Adds 0.3ms p99 to request path — acceptable.',
    topics: ['ai', 'billing', 'observability'],
    daysAgo: 9,
  },
  {
    owner: 'alex',
    title: 'Why we rejected RAG-as-a-service vendors',
    content:
      "Looked at LlamaIndex Cloud, Vectara, AzureSearch. All add latency, vendor risk, and don't fit our per-tenant data isolation model. We own our retrieval stack.",
    topics: ['ai', 'rag', 'build-vs-buy', 'architecture'],
    daysAgo: 8,
  },
  {
    owner: 'sarah',
    title: 'Reranker eval: Cohere rerank-3 vs cross-encoder',
    content:
      'Cohere rerank-3 lifts recall@10 from 0.91 to 0.94 on our eval. Self-hosted cross-encoder (ms-marco MiniLM) gets 0.93 at zero per-query cost. Trade-off: hosting overhead vs API spend.',
    topics: ['ai', 'reranking', 'cohere', 'rag'],
    daysAgo: 7,
  },
  {
    owner: 'bob',
    title: 'Async job queue for AI synthesis',
    content:
      'BullMQ queue for AI synthesis jobs. Worker processes one job at a time per concurrency slot. Retries with exponential backoff. Dead-letter queue for jobs that fail >3 times — surfaced in admin UI.',
    topics: ['ai', 'queue', 'bullmq', 'async'],
    daysAgo: 6,
  },
  {
    owner: 'alex',
    title: 'OpenAI rate limit strategy',
    content:
      'TPM limits hit at scale. Solutions: (1) AI Gateway as middleware for cross-org rate-limit pooling, (2) BYOK lets enterprise tenants use their own keys. Default tier on free plan throttled hard to encourage upgrade.',
    topics: ['ai', 'openai', 'rate-limiting', 'byok'],
    daysAgo: 5,
  },
  {
    owner: 'sarah',
    title: 'Anthropic batch API for offline jobs',
    content:
      'Anthropic Batch API: 50% cost discount, 24h SLA. Perfect for nightly briefing generation where latency does not matter. Cuts our briefing compute bill in half.',
    topics: ['ai', 'claude', 'batch', 'cost'],
    daysAgo: 4,
  },
  {
    owner: 'bob',
    title: 'AI Gateway: provider abstraction layer',
    content:
      'Vercel AI Gateway routes between OpenAI, Anthropic, Bedrock with provider failover. Single client interface. Useful for BYOK orgs that want to bring their own provider keys.',
    topics: ['ai', 'ai-gateway', 'provider-abstraction', 'byok'],
    daysAgo: 3,
  },
  {
    owner: 'alex',
    title: 'MCP server for Cognia memory',
    content:
      "Cognia MCP server exposes 3 tools: cognia.search, cognia.get_memory, cognia.list_memories. Cursor and Claude Desktop can query a user's company memory natively. This is the agent-native distribution channel.",
    topics: ['ai', 'mcp', 'agents', 'cursor', 'claude'],
    daysAgo: 1,
  },
]

const FRONTEND: MemorySeed[] = [
  {
    owner: 'bob',
    title: 'React 18 vs Solid for our stack',
    content:
      'Stayed on React 18. Solid wins on raw perf but ecosystem (Radix, shadcn, Tailwind component libs) is React-only for our needs. Bundle size diff is <5% with code-splitting.',
    topics: ['frontend', 'react', 'solid', 'performance'],
    daysAgo: 25,
  },
  {
    owner: 'bob',
    title: 'Tailwind v4 migration plan',
    content:
      'Tailwind v4 native CSS engine ditches PostCSS dependency, faster build. Migration is mostly @import changes. Plan: upgrade in Q2 after v4 stable.',
    topics: ['frontend', 'tailwind', 'css', 'build'],
    daysAgo: 22,
  },
  {
    owner: 'bob',
    title: 'Vite vs Next.js for client app',
    content:
      "Stayed on Vite for SPA. Next.js adds value for SSR/RSC but our app is fully authenticated — no public SEO surface to optimize. Vite's dev experience is unmatched.",
    topics: ['frontend', 'vite', 'nextjs', 'build'],
    daysAgo: 20,
  },
  {
    owner: 'sarah',
    title: 'shadcn/ui adoption decision',
    content:
      'Adopted shadcn/ui — code-owned components built on Radix primitives. No npm dep to lock us into upstream styling. Tailwind classes inline in component files for easy customization.',
    topics: ['frontend', 'shadcn', 'radix', 'design-system'],
    daysAgo: 18,
  },
  {
    owner: 'bob',
    title: 'Three.js + React Three Fiber for memory mesh',
    content:
      'R3F is the right abstraction for declarative 3D. Force-directed layout via d3-force-3d. Instanced meshes for nodes (perf) plus per-node click handling via raycast. Smooth at 5k nodes.',
    topics: ['frontend', 'three-js', 'r3f', 'memory-mesh', 'performance'],
    daysAgo: 16,
  },
  {
    owner: 'sarah',
    title: 'TanStack Query vs SWR',
    content:
      'TanStack Query wins on devtools and mutation handling. Migration from SWR took 4 hours. Cache invalidation patterns are clearer.',
    topics: ['frontend', 'tanstack-query', 'swr', 'data-fetching'],
    daysAgo: 14,
  },
  {
    owner: 'bob',
    title: 'Form library decision: react-hook-form',
    content:
      'react-hook-form + Zod resolver. Tiny bundle, uncontrolled inputs, validation co-located with schema. Replaced Formik in Sept.',
    topics: ['frontend', 'react-hook-form', 'forms', 'zod'],
    daysAgo: 12,
  },
  {
    owner: 'sarah',
    title: 'Framer Motion for page transitions',
    content:
      'Framer Motion for shared-layout transitions. AnimatePresence wraps Routes for clean exit animations. Bundle hit is real (60kb gz) — code-split per route.',
    topics: ['frontend', 'framer-motion', 'animation'],
    daysAgo: 10,
  },
  {
    owner: 'bob',
    title: 'Vitest setup for component tests',
    content:
      'Vitest + RTL + jsdom. 30 tests run in 2.5s. setupFiles cleans up after each test. Coverage with @vitest/coverage-v8.',
    topics: ['frontend', 'vitest', 'testing', 'rtl'],
    daysAgo: 9,
  },
  {
    owner: 'sarah',
    title: 'Why we use cmdk for spotlight',
    content:
      'cmdk by pacocoursey is the best command-menu primitive in React. Composable, accessible, fast. Backs our Cmd-K spotlight search.',
    topics: ['frontend', 'cmdk', 'spotlight', 'a11y'],
    daysAgo: 8,
  },
  {
    owner: 'bob',
    title: 'Sonner for toast notifications',
    content:
      'Sonner ships beautifully out of the box. Stack management, swipe-to-dismiss, theme-aware. Replaced react-hot-toast — better DX.',
    topics: ['frontend', 'sonner', 'toast', 'ux'],
    daysAgo: 6,
  },
  {
    owner: 'sarah',
    title: 'Bundle size budget: under 800kb gz',
    content:
      'Hard budget: 800kb gz for entry chunk. CI fails if we cross. Achieved via route-level code-splitting and lazy imports for heavy deps (Three.js, Framer Motion).',
    topics: ['frontend', 'performance', 'bundle-size', 'ci'],
    daysAgo: 5,
  },
  {
    owner: 'bob',
    title: 'Markdown editor: tiptap vs MDX vs uiw',
    content:
      'Picked @uiw/react-md-editor for simplicity. tiptap is more powerful but 200kb+. MDX is for docs, not user content. Memory editor uses uiw.',
    topics: ['frontend', 'markdown', 'tiptap', 'editor'],
    daysAgo: 4,
  },
  {
    owner: 'sarah',
    title: 'CSP nonce strategy',
    content:
      'CSP with nonces for inline scripts. helmet middleware injects nonce into res.locals. SSR templates read it. No CSP violations in production.',
    topics: ['frontend', 'csp', 'security', 'helmet'],
    daysAgo: 2,
  },
  {
    owner: 'bob',
    title: 'Virtualized lists with @tanstack/react-virtual',
    content:
      'Switched memory list from full-render to virtual at 100+ rows. Smooth scroll on 10k items. Item-size estimator handles variable heights.',
    topics: ['frontend', 'virtualization', 'tanstack', 'performance'],
    daysAgo: 1,
  },
]

const BACKEND: MemorySeed[] = [
  {
    owner: 'bob',
    title: 'Postgres vs MongoDB for relational data',
    content:
      "Postgres won. Strong consistency, joins, JSONB for flexibility, mature tooling, pgvector option. MongoDB's schema flexibility costs us at the consistency layer for billing/audit data.",
    topics: ['backend', 'postgres', 'mongodb', 'database'],
    daysAgo: 24,
  },
  {
    owner: 'bob',
    title: 'Prisma vs Drizzle ORM',
    content:
      "Prisma for now. Drizzle is faster (no separate query engine) and more SQL-y, but Prisma's migrations + studio + types are tighter. Revisit when Prisma's perf becomes a blocker.",
    topics: ['backend', 'prisma', 'drizzle', 'orm'],
    daysAgo: 21,
  },
  {
    owner: 'alex',
    title: 'REST vs GraphQL for our public API',
    content:
      "REST. GraphQL's flexibility costs us in caching, rate limiting, and on-call burden. Our public surface is small enough that REST + OpenAPI suffices. Revisit if a customer demands GraphQL.",
    topics: ['backend', 'rest', 'graphql', 'api'],
    daysAgo: 19,
  },
  {
    owner: 'sarah',
    title: 'JWT vs server-side sessions',
    content:
      'JWT short-TTL + refresh-token rotation. Server-side sessions would require sticky LB or session store everywhere. JWT with revocation list in Redis gives us the best of both.',
    topics: ['backend', 'jwt', 'session', 'auth'],
    daysAgo: 17,
  },
  {
    owner: 'bob',
    title: 'Express vs Fastify vs Hono',
    content:
      'Stayed on Express. Mature middleware ecosystem (helmet, cors, multer all just work). Fastify is faster but switching cost not justified. Hono is interesting for edge but we are not edge.',
    topics: ['backend', 'express', 'fastify', 'hono'],
    daysAgo: 15,
  },
  {
    owner: 'bob',
    title: 'BullMQ for async work',
    content:
      'BullMQ on Redis. Queues: content-worker, profile-worker, document-worker, briefing-worker, audit-retention, trash-purge. DLQ for poisoned jobs. Web UI via bull-board.',
    topics: ['backend', 'bullmq', 'redis', 'queue'],
    daysAgo: 13,
  },
  {
    owner: 'alex',
    title: 'Rate limiting per-user vs per-IP',
    content:
      'Per-user-or-IP key extractor: u:userId when authenticated, ip:addr when anonymous. Stops office-NAT lockouts. Search 60/min per user, login 5/15min per IP.',
    topics: ['backend', 'rate-limiting', 'security'],
    daysAgo: 11,
  },
  {
    owner: 'sarah',
    title: 'Helmet HTTP security headers',
    content:
      'helmet defaults plus tightened CSP. HSTS preload-eligible. X-Frame-Options DENY (we have no iframe surface). Cuts a category of OWASP Top 10 by default.',
    topics: ['backend', 'helmet', 'security', 'csp'],
    daysAgo: 9,
  },
  {
    owner: 'bob',
    title: 'Webhook idempotency strategy',
    content:
      'WebhookDelivery row keyed by (provider, event_id). Duplicate deliveries are dropped. BullMQ handles retries with exponential backoff. DLQ exposes dead deliveries to org admins.',
    topics: ['backend', 'webhooks', 'idempotency'],
    daysAgo: 7,
  },
  {
    owner: 'sarah',
    title: 'AES-256-GCM for secrets at rest',
    content:
      'OAuth tokens, OIDC client secrets, BYOK keys all encrypted with AES-256-GCM. Keys via TOKEN_ENCRYPTION_KEY env var (KMS migration planned). Boot fails if key absent.',
    topics: ['backend', 'encryption', 'security', 'aes'],
    daysAgo: 5,
  },
  {
    owner: 'bob',
    title: 'Refresh token rotation with reuse detection',
    content:
      'Refresh tokens are opaque sha256-hashed. Each rotation creates a new family member, marks parent used. Reuse detection: presented token already-used = revoke entire family + log warn.',
    topics: ['backend', 'refresh-token', 'security', 'auth'],
    daysAgo: 4,
  },
  {
    owner: 'alex',
    title: 'JWT jti for revocation',
    content:
      'Every JWT carries a UUID jti. Revocation list in Redis with PX TTL = remaining JWT lifetime. Logout/admin-revoke writes to the list. Auth middleware checks on every request.',
    topics: ['backend', 'jwt', 'jti', 'auth'],
    daysAgo: 3,
  },
  {
    owner: 'bob',
    title: 'Audit log retention worker',
    content:
      'Per-org retention: 30/90/180/365 days or unlimited. Nightly worker purges expired rows. Org admins set policy in security tab.',
    topics: ['backend', 'audit-log', 'retention'],
    daysAgo: 2,
  },
  {
    owner: 'sarah',
    title: 'Permission-based RBAC',
    content:
      '33-permission catalog. OrgRole-to-permission mapping in code (no custom roles in v1). requirePermission middleware returns 403 PERMISSION_DENIED with the offending permission name.',
    topics: ['backend', 'rbac', 'permissions', 'authorization'],
    daysAgo: 1,
  },
  {
    owner: 'alex',
    title: 'OpenAPI spec auto-served at /openapi.json',
    content:
      'Hand-authored OpenAPI 3 spec for /v1 endpoints. Served at /openapi.json. Will move to zod-to-openapi auto-generation in next phase.',
    topics: ['backend', 'openapi', 'api', 'docs'],
    daysAgo: 1,
  },
]

const DEVOPS: MemorySeed[] = [
  {
    owner: 'bob',
    title: 'Docker compose for local dev',
    content:
      'Postgres 15, Redis 7, Qdrant in one docker-compose. Mac users can boot whole stack in 4 seconds. .env.example documents required keys.',
    topics: ['devops', 'docker', 'local-dev'],
    daysAgo: 25,
  },
  {
    owner: 'bob',
    title: 'Kubernetes vs ECS for production',
    content:
      'Picked ECS Fargate. K8s is overkill for our scale (3 services). ECS task definitions are simpler. Revisit if we cross 20+ microservices.',
    topics: ['devops', 'kubernetes', 'ecs', 'aws'],
    daysAgo: 23,
  },
  {
    owner: 'alex',
    title: 'Datadog vs Honeycomb for observability',
    content:
      'Datadog for metrics + APM. Honeycomb for distributed tracing on hot paths. Cost: $400/mo combined at our scale. Revisit at 100x traffic.',
    topics: ['devops', 'datadog', 'honeycomb', 'observability'],
    daysAgo: 20,
  },
  {
    owner: 'bob',
    title: 'CI/CD: GitHub Actions vs Buildkite',
    content:
      'GitHub Actions. Tight integration with PRs, free for OSS, simple secrets. Buildkite better for self-hosted runners but we have no compliance reason.',
    topics: ['devops', 'ci-cd', 'github-actions'],
    daysAgo: 18,
  },
  {
    owner: 'sarah',
    title: 'Terraform for AWS resources',
    content:
      'Terraform for VPC, RDS, S3, ECS. State in S3 with DynamoDB lock. Workspaces per env. tflint in CI.',
    topics: ['devops', 'terraform', 'aws', 'iac'],
    daysAgo: 16,
  },
  {
    owner: 'bob',
    title: 'Postgres backup + PITR',
    content:
      'RDS automated backups, 7-day window. Tested PITR restore quarterly. Recovery objective: RPO 5min, RTO 1hr.',
    topics: ['devops', 'postgres', 'backup', 'rds'],
    daysAgo: 14,
  },
  {
    owner: 'alex',
    title: 'Sentry for error tracking',
    content:
      'Sentry per-environment. Source maps uploaded by CI. Alert on new error groups via Slack. Triage rotation on engineering oncall.',
    topics: ['devops', 'sentry', 'errors', 'oncall'],
    daysAgo: 12,
  },
  {
    owner: 'bob',
    title: 'CDN strategy: CloudFront vs Cloudflare',
    content:
      'Cloudflare. Better DDoS, free tier covers our needs, Workers for edge logic if needed. CloudFront integrates better with AWS but we already have Cloudflare for DNS.',
    topics: ['devops', 'cdn', 'cloudflare', 'cloudfront'],
    daysAgo: 11,
  },
  {
    owner: 'sarah',
    title: 'Image optimization with Sharp',
    content:
      'Sharp on the API for resize/webp. Cached on Cloudflare. Saves ~70% bandwidth on memory-card thumbnails.',
    topics: ['devops', 'sharp', 'images', 'performance'],
    daysAgo: 9,
  },
  {
    owner: 'bob',
    title: 'Blue/green vs rolling deploy',
    content:
      'Rolling deploy on ECS. 50% min healthy. Auto-rollback on health check failures. Blue/green only for breaking schema migrations.',
    topics: ['devops', 'deployment', 'ecs'],
    daysAgo: 7,
  },
  {
    owner: 'alex',
    title: 'Secrets rotation policy',
    content:
      'JWT secret + DB password + OAuth tokens rotated quarterly. Stored in AWS Secrets Manager. ECS pulls at task start. Audit log of every access.',
    topics: ['devops', 'secrets', 'aws', 'security'],
    daysAgo: 5,
  },
  {
    owner: 'bob',
    title: 'On-call rotation',
    content:
      'Weekly rotation, 3 engineers. PagerDuty integrates with Sentry + Datadog. Severity levels: SEV1 (page), SEV2 (slack), SEV3 (ticket).',
    topics: ['devops', 'oncall', 'pagerduty'],
    daysAgo: 4,
  },
  {
    owner: 'sarah',
    title: 'Load test with k6',
    content:
      'k6 scripts for auth, search, memory create. Soak test 100 RPS for 1hr. p99 search latency stays under 200ms at our current data size.',
    topics: ['devops', 'k6', 'load-test', 'performance'],
    daysAgo: 3,
  },
  {
    owner: 'bob',
    title: 'Log aggregation with Loki',
    content:
      'Loki + Grafana. JSON-structured logs from pino. Querying with LogQL. 30-day retention. Cheaper than Datadog logs at our volume.',
    topics: ['devops', 'loki', 'logs', 'grafana'],
    daysAgo: 2,
  },
  {
    owner: 'alex',
    title: 'Disaster recovery runbook',
    content:
      'Quarterly DR drill: restore Postgres from snapshot, replay Redis from AOF, restore Qdrant from S3 snapshot. Recovery in under 30min.',
    topics: ['devops', 'dr', 'runbook', 'business-continuity'],
    daysAgo: 1,
  },
]

const CUSTOMER: MemorySeed[] = [
  {
    owner: 'alex',
    title: 'Acme call: data residency is the blocker',
    content:
      'Acme says: "We can\'t move forward without proof our data stays in the EU." Self-hosted Qdrant on Frankfurt resolves it. Sent the architecture diagram, they\'re reviewing.',
    topics: ['customer', 'acme', 'data-residency', 'enterprise'],
    daysAgo: 24,
  },
  {
    owner: 'sarah',
    title: 'Globex feedback: search recall',
    content:
      'Globex PM says recall on technical jargon is poor. Hypothesis: out-of-vocabulary terms dominate. Solution: hybrid sparse+dense search, scheduled for Q2.',
    topics: ['customer', 'globex', 'search', 'recall'],
    daysAgo: 21,
  },
  {
    owner: 'alex',
    title: 'Initech: "we keep losing context when an engineer leaves"',
    content:
      'Initech VP eng said it directly: every senior departure costs them 6 months of onboarding pain. They want exactly what Cognia is. Closed $25k pilot for Q1.',
    topics: ['customer', 'initech', 'institutional-memory', 'pain-point'],
    daysAgo: 19,
  },
  {
    owner: 'bob',
    title: 'Hooli ops: Slack integration is non-negotiable',
    content:
      "Hooli's ops team lives in Slack. They want every Slack thread captured automatically. Our Slack plugin is the minimum bar.",
    topics: ['customer', 'hooli', 'slack', 'integration'],
    daysAgo: 17,
  },
  {
    owner: 'sarah',
    title: 'Pied Piper: "we tried Glean, too generic"',
    content:
      'Pied Piper churned from Glean. Their feedback: "Glean indexes everything but doesn\'t understand decisions. We want the why, not just the what."',
    topics: ['customer', 'pied-piper', 'glean', 'competition'],
    daysAgo: 15,
  },
  {
    owner: 'alex',
    title: 'Stark Industries SOC 2 question',
    content:
      'Stark procurement asked for SOC 2 letter. Type 1 in progress, Type 2 in 6 months. Sent the auditor letter from Vanta. They accepted.',
    topics: ['customer', 'stark', 'soc2', 'compliance', 'enterprise'],
    daysAgo: 13,
  },
  {
    owner: 'bob',
    title: 'Wonka: BYOK requirement',
    content:
      "Wonka's legal blocked us until BYOK landed. They want their own Anthropic key, not ours. Now unblocked, $40k ARR pipeline.",
    topics: ['customer', 'wonka', 'byok', 'enterprise'],
    daysAgo: 11,
  },
  {
    owner: 'sarah',
    title: 'Soylent feedback: mesh visualization is the hook',
    content:
      'Demo to Soylent: their CEO got hooked on the 3D memory mesh. "I want to see how my team\'s thinking is connected." Closed pilot.',
    topics: ['customer', 'soylent', 'memory-mesh', 'visualization'],
    daysAgo: 9,
  },
  {
    owner: 'alex',
    title: 'Cyberdyne: "auditable AI is non-negotiable"',
    content:
      'Cyberdyne procurement: every AI answer needs auditable citations. Our forced-citations + author attribution sells itself. Closed $60k.',
    topics: ['customer', 'cyberdyne', 'citations', 'audit', 'enterprise'],
    daysAgo: 8,
  },
  {
    owner: 'bob',
    title: 'Tyrell pilot kickoff',
    content:
      'Tyrell starting a 30-person pilot. Budget approved $30k for Q1. Slack integration enabled, extension rolled out via MDM.',
    topics: ['customer', 'tyrell', 'pilot', 'mdm'],
    daysAgo: 6,
  },
  {
    owner: 'sarah',
    title: 'Massive Dynamic: SCIM provisioning required',
    content:
      'Massive Dynamic uses Okta. Need SCIM for auto-provision/deprovision. SCIM v2 endpoints shipped. Token issued, integration test passed.',
    topics: ['customer', 'massive-dynamic', 'scim', 'okta', 'enterprise'],
    daysAgo: 5,
  },
  {
    owner: 'alex',
    title: 'Dunder Mifflin: "no AI, just better notes"',
    content:
      'Dunder is allergic to AI buzzwords. They want a smarter Notion. Deemphasized AI in deck, leaned on capture-and-search. Closed pilot.',
    topics: ['customer', 'dunder-mifflin', 'positioning'],
    daysAgo: 4,
  },
  {
    owner: 'bob',
    title: 'Vandelay: "our extension was banned by IT"',
    content:
      "Vandelay's IT blocked our extension on managed Chrome until Chrome Enterprise policy template was provided. Now whitelisted, deployment unblocked.",
    topics: ['customer', 'vandelay', 'chrome', 'mdm', 'enterprise'],
    daysAgo: 3,
  },
  {
    owner: 'sarah',
    title: 'Oscorp: legal hold for departing exec',
    content:
      "Oscorp asked us to legal-hold a departing exec's memories pending litigation. Our legal_hold model already supports this. Held, audit logged.",
    topics: ['customer', 'oscorp', 'legal-hold', 'compliance'],
    daysAgo: 2,
  },
  {
    owner: 'alex',
    title: 'Top customer pain ranked',
    content:
      "Pain rank from 8 customer interviews: (1) tribal knowledge loss when people leave, (2) decisions never get written down, (3) AI tools don't see internal context. We address all three.",
    topics: ['customer', 'positioning', 'pain-points'],
    daysAgo: 1,
  },
]

const ALL_MEMORIES = [...VECTOR_DB, ...AI_LLM, ...FRONTEND, ...BACKEND, ...DEVOPS, ...CUSTOMER]

async function purgeExisting(): Promise<void> {
  const existing = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (existing) {
    // Cascade-delete via the org → memberships, memories with org_id, etc.
    await prisma.organization.delete({ where: { id: existing.id } })
    logger.log('[seed:yc-demo] purged existing org', { id: existing.id })
  }
  // Also delete the seed users so re-runs are fully clean
  for (const u of Object.values(USERS)) {
    const found = await prisma.user.findUnique({ where: { email: u.email } })
    if (found) {
      await prisma.user.delete({ where: { id: found.id } })
    }
  }
}

async function createUsers() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const now = new Date()
  const alex = await prisma.user.create({
    data: {
      email: USERS.alex.email,
      password_hash: passwordHash,
      account_type: 'ORGANIZATION',
      email_verified_at: now,
    },
  })
  const sarah = await prisma.user.create({
    data: {
      email: USERS.sarah.email,
      password_hash: passwordHash,
      account_type: 'ORGANIZATION',
      email_verified_at: now,
    },
  })
  const bob = await prisma.user.create({
    data: {
      email: USERS.bob.email,
      password_hash: passwordHash,
      account_type: 'ORGANIZATION',
      email_verified_at: now,
    },
  })
  return { alex, sarah, bob }
}

async function createOrg(adminId: string, sarahId: string, bobId: string) {
  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      industry: 'Software / AI',
      team_size: '1-10',
      members: {
        create: [
          { user_id: adminId, role: 'ADMIN' },
          { user_id: sarahId, role: 'EDITOR' },
          { user_id: bobId, role: 'EDITOR' },
        ],
      },
    },
  })
  return org
}

async function seedMemories(
  orgId: string,
  owners: { alex: { id: string }; sarah: { id: string }; bob: { id: string } }
): Promise<number> {
  let inserted = 0
  for (const m of ALL_MEMORIES) {
    const userId = owners[m.owner].id
    const ts = Date.now() - m.daysAgo * 24 * 60 * 60 * 1000
    const slug = m.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    await prisma.memory.create({
      data: {
        user_id: userId,
        organization_id: orgId,
        source: 'demo',
        source_type: 'DOCUMENT',
        memory_type: 'REFERENCE',
        title: m.title,
        content: m.content,
        url: `https://example.com/${slug}`,
        timestamp: BigInt(ts),
        created_at: new Date(ts),
        last_accessed: new Date(ts),
        confidence_score: 0.7 + Math.random() * 0.2,
        importance_score: 0.4 + Math.random() * 0.5,
        page_metadata: { topics: m.topics, demo: true },
      },
    })
    inserted++
  }
  return inserted
}

async function main(): Promise<void> {
  logger.log('[seed:yc-demo] starting')
  await purgeExisting()
  const { alex, sarah, bob } = await createUsers()
  const org = await createOrg(alex.id, sarah.id, bob.id)
  const count = await seedMemories(org.id, { alex, sarah, bob })
  logger.log('[seed:yc-demo] complete', {
    orgSlug: ORG_SLUG,
    orgName: ORG_NAME,
    memoriesInserted: count,
    users: 3,
    adminLogin: USERS.alex.email,
    password: PASSWORD,
    note: 'Embeddings will be generated by content-worker over the next 1-2 minutes.',
  })
  await prisma.$disconnect()
}

main().catch(err => {
  logger.error('[seed:yc-demo] failed', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  process.exit(1)
})
