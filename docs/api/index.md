# REST API

Cognia exposes a stable, versioned REST API at `https://api.cognia.xyz`. All endpoints are JSON over HTTPS. Authentication is by API key — see [Authentication](./auth).

## Endpoint families

| Path | Purpose |
|---|---|
| `/v1/memories`              | CRUD on individual memories |
| `/v1/search`                | Hybrid retrieval |
| `/mcp/v1/jsonrpc`           | Model Context Protocol over JSON-RPC |
| `/api/auth/*`, `/api/sso/*` | Session-based auth (for the web app, not API keys) |
| `/api/admin/*`, `/api/billing/*` | Internal — not public |

The `/v1/*` and `/mcp/*` namespaces are the **public surface**. Everything under `/api/*` is internal and may break without notice.

## Versioning

- Breaking changes go in a new major version: `/v1/` → `/v2/`. Both versions run side-by-side for **at least 12 months**.
- Additive changes (new fields, new optional parameters, new endpoints) ship in `/v1/` without a version bump.
- We never mutate the meaning of an existing field. New behavior gets a new field.

## Pages

- [Authentication](./auth) — API keys, scopes, rate limits
- [Memories](./memories) — list, retrieve, update, delete
- [Search](./search) — `POST /v1/search`
- [MCP / JSON-RPC](./mcp-jsonrpc) — `POST /mcp/v1/jsonrpc`
