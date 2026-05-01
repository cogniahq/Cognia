# Self-hosting

Run Cognia on your own infrastructure. Useful for compliance-heavy tenants (legal, healthcare, defense) who can't send memories to a third-party SaaS.

## Architecture

```
            ┌──────────────────────────────────┐
   client → │ Cognia API (Node 20, Express)    │
            └──────────────────────────────────┘
                  │           │           │
                  ▼           ▼           ▼
            ┌─────────┐ ┌──────────┐ ┌────────┐
            │ Postgres│ │  Qdrant  │ │ Redis  │
            │  (15+)  │ │  (1.10+) │ │ (7+)   │
            └─────────┘ └──────────┘ └────────┘
                  │           │
                  └───────────┘
                  │
                  ▼
            ┌─────────────────────────────┐
            │ BullMQ workers (in-process) │
            │  - content-worker           │
            │  - document-worker          │
            │  - mesh-recompute-worker    │
            │  - audit-retention-worker   │
            └─────────────────────────────┘
                  │
                  ▼
            ┌─────────────────────────────┐
            │ Embedding / rerank providers│
            │  OpenAI / Gemini / Ollama   │
            │  Cohere / Voyage / Jina     │
            └─────────────────────────────┘
```

## Minimum requirements

| Component | Spec |
|---|---|
| API node          | 4 vCPU, 8 GB RAM, Node 20 |
| Postgres          | 15+, 50 GB SSD |
| Qdrant            | 1.10+, 16 GB RAM minimum (more for >1M vectors) |
| Redis             | 7+, 4 GB RAM |
| OpenAI / equiv    | API key with embeddings access |
| Cohere / equiv    | Optional but recommended for rerank quality |

## Deploy

### Docker Compose (single host)

```yaml
# docker-compose.yml (excerpt)
services:
  api:
    image: cognia/api:latest
    env_file: .env
    ports: ['3000:3000']
    depends_on: [postgres, qdrant, redis]

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: cognia
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes: ['./pgdata:/var/lib/postgresql/data']

  qdrant:
    image: qdrant/qdrant:v1.13.0
    volumes: ['./qdrant_storage:/qdrant/storage']
    ports: ['6333:6333']

  redis:
    image: redis:7-alpine
    volumes: ['./redis_data:/data']
```

Then:

```sh
docker compose up -d
docker compose exec api npm run db:deploy   # apply migrations
```

### Kubernetes

A reference Helm chart lives at `charts/cognia/` in the main repo. Production values:

```yaml
api:
  replicas: 3
  resources: { requests: { cpu: 1, memory: 2Gi }, limits: { cpu: 2, memory: 4Gi } }

worker:
  replicas: 2  # processes BullMQ jobs

postgres: { externalUrl: "..." }    # use a managed Postgres
qdrant:   { externalUrl: "..." }    # use Qdrant Cloud or self-hosted cluster
redis:    { externalUrl: "..." }    # ElastiCache / Upstash
```

## Configuration

Critical env vars (see `.env.example` for the complete list):

```sh
# Storage backends
DATABASE_URL=postgresql://…
QDRANT_URL=https://qdrant.internal:6333
REDIS_URL=redis://…

# Embeddings
EMBED_PROVIDER=openai
OPENAI_API_KEY=sk-…
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# Reranking (optional but recommended)
RERANK_PROVIDER=cohere
COHERE_API_KEY=…

# Sessions / cookies
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_DOMAIN=.cognia.example.com
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

## Operating

### Initial setup

```sh
npm run db:deploy           # apply migrations
npm run clean:qdrant        # ensure collection exists with the right schema
npm run start:prod          # launches api + workers via pm2
```

### Backfilling existing data

If you're migrating from an older Cognia version (or re-embedding after a model swap):

```sh
npm run backfill:search                  # all orgs
npm run backfill:search -- --org=<uuid>  # one org
```

### Monitoring

The API exposes:

- `GET /api/admin/health` — overall health (db, redis, qdrant)
- `GET /api/admin/stats` — index size, queue depth, worker latency

Wire these to Prometheus / Datadog. Worker queue depth is the single best leading indicator of "we need to scale workers."

## Security checklist

- [ ] Postgres reachable only from the API and worker pods (private subnet, security group)
- [ ] Qdrant API key set; transport is TLS
- [ ] Redis with password + TLS
- [ ] `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY` are 32-byte random hex, stored in a secret manager
- [ ] HTTPS everywhere; HSTS enabled
- [ ] CORS origin pinned to your front-end domain
- [ ] OpenAI / Cohere keys scoped to org-specific projects (not master keys)
- [ ] Audit log retention configured (`AUDIT_LOG_RETENTION_DAYS`)
