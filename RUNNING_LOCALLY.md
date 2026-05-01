# Running Cognia locally with Docker

Two modes, depending on what you want to do.

| You want to… | Command |
|---|---|
| Spin up infra only (Postgres, Qdrant, Redis), and run the API on the host with `npm start` | `cd Cognia/api && docker compose up -d` |
| Spin up **everything in Docker** (infra + API + workers + migrations) | `cd Cognia/api && docker compose --profile app up -d --build` |

Both modes use the same `docker-compose.yml`. The `app` profile gates the API and migration containers so they only start when explicitly requested.

## Prerequisites

- Docker 24+ with Compose v2
- A `.env` file in `Cognia/api/` with at least `OPENAI_API_KEY` set. Copy from `.env.example` and fill in.

## Mode 1 — Infra only (host-dev)

This is the original developer workflow. Use it when you're actively editing source and want hot reload.

```sh
cd Cognia/api
docker compose up -d
npm install
npm run db:setup    # generate prisma client + apply migrations
npm start           # nodemon on the host, port 3000
```

Connection strings in `.env` should point to `localhost`:

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cognia
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6380   # see docker-compose.override.yml
```

The override file maps Redis to host port 6380 to avoid colliding with a host-installed Redis. If you don't have one, you can delete the override and use 6379.

## Mode 2 — Everything in Docker

Use this when you want a self-contained, production-shaped stack — no host Node, no host package install.

```sh
cd Cognia/api
docker compose --profile app up -d --build
```

What happens:

1. **`postgres`, `qdrant`, `redis`** start and become healthy.
2. **`migrate`** runs `prisma migrate deploy` against postgres and exits.
3. **`api`** starts on port 3000, connecting to the in-network services (`postgres:5432`, `qdrant:6333`, `redis:6379`). It inherits secrets from `.env` but overrides the connection strings with the docker-network names.
4. The API's in-process BullMQ workers (content, document, mesh-recompute, audit-retention, trash-purge, webhook) start automatically — no separate worker container needed.

Verify:

```sh
curl http://localhost:3000/health
# → {"status":"ok"}

docker compose ps
# All services should be "running" or "exited (0)" for migrate
```

## First-run setup (Mode 2)

After the first `up`, you'll likely want to:

```sh
# Tail API logs
docker compose logs -f api

# Open a shell inside the API container (e.g. for prisma studio)
docker compose exec api sh

# Re-embed everything against the new hybrid index (only needed once after upgrading from a pre-hybrid version)
docker compose exec api npx ts-node src/scripts/backfill-search-index.script.ts

# Seed the Project Polaris handover demo into the Blit Labs workspace
docker compose exec api npm run seed:polaris
```

## Stopping & cleanup

```sh
docker compose --profile app down            # stop everything, keep data
docker compose --profile app down -v         # also drop postgres + qdrant + redis volumes
docker compose --profile app build --no-cache api  # rebuild API after code changes
```

## Common issues

**`migrate` container exits with `error: role "postgres" does not exist`**

The first-boot postgres init takes a few seconds. The compose file already has `service_healthy` waits, so this only happens if your `init-scripts/` directory contains a misbehaving SQL file. Run `docker compose down -v` and try again.

**API healthcheck fails repeatedly**

```sh
docker compose logs api | tail -50
```

Look for `[startup] qdrant_unavailable` or `[startup] database_connected` lines. If qdrant is the problem, `docker compose restart qdrant` and let the collection auto-recreate.

**OpenAI 401 / Cohere 401**

The API service inherits keys from `.env`. Make sure they're set there — `environment:` in compose only overrides connection strings, not provider keys.

## What about the SDK / MCP / Docs?

Those are separate npm packages, not server-side services. None of them need Docker:

```sh
cd Cognia/sdk  && npm install && npm run build
cd Cognia/mcp  && npm install && npm run build
cd Cognia/docs && npm install && npm run dev    # docs dev server at :5173
```

The MCP server is a stdio binary; you wire it into Claude Desktop / Cursor / Cline by config — see `Cognia/mcp/README.md`.
