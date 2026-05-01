# Authentication

All `/v1/*` and `/mcp/*` endpoints require an API key passed as a Bearer token:

```
Authorization: Bearer ck_live_abc123…
```

Keys are scoped (`search`, `memories.read`, `memories.write`, `*`) and rate-limited per-key. Generate one at **Settings → API keys**.

See the [API keys guide](../guides/api-keys) for the full lifecycle (creation, scoping, rotation, revocation, rate limits).

## Errors

| Status | Code | Cause |
|---|---|---|
| `401` | `unauthorized`             | Missing / malformed / revoked key |
| `403` | `forbidden`                | Key is valid but lacks the required scope |
| `429` | `rate_limit_exceeded`      | More than the per-key cap; respect `Retry-After` |

## Sample failed response

```http
HTTP/1.1 403 Forbidden
content-type: application/json
x-request-id: req_01HF0WQ…

{
  "error": "forbidden",
  "message": "Missing scope: search"
}
```

## Why API keys instead of OAuth?

OAuth makes sense for human-driven flows (web app, mobile app); API keys make sense for **machine-driven** flows where rotation, scoping, and revocation are the primary concerns. Most Cognia integrations are machines, so we lead with keys.

For browser-side code that needs to act as a specific user, use the session-cookie auth at `/api/auth/*`. This is **not part of the public API contract** — endpoints can change without notice.
