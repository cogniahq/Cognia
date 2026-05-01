# API keys & scopes

API keys are how your code, scripts, and MCP clients authenticate to Cognia. They're scoped, revocable, and rate-limited per-key.

## Key formats

| Prefix | Environment | Audit |
|---|---|---|
| `ck_live_…` | Production | Logged with caller user_id, scope, and IP |
| `ck_test_…` | Staging / dev | Same audit, no billing impact |

A key is a 32-byte random secret encoded as base64-url with the prefix. Cognia stores only the SHA-256 hash; the cleartext is shown once at creation.

## Scopes

| Scope | Permits |
|---|---|
| `search`            | `POST /v1/search` and `cognia_search` (MCP). Required for retrieval. |
| `memories.read`     | `GET /v1/memories`, `GET /v1/memories/:id`, MCP `cognia_get_memory` / `cognia_list_memories`. |
| `memories.write`    | `PATCH`, `DELETE` on `/v1/memories/:id`. |
| `*`                 | All current and future scopes. Use sparingly. |

Scopes are additive. A key with `[search, memories.read]` can read but cannot write.

## Rate limits

Every key gets **100 requests/minute** by default (configurable per plan). Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header — the SDK respects this automatically.

The limit is per-key, not per-user. Issuing multiple keys to one user does **not** multiply throughput; the same user has a parallel global cap.

## Best practices

- **One key per integration.** Create separate keys for the MCP server, your CLI tooling, and any service. Revoking is then surgical.
- **Never commit keys.** They're trivially discoverable via GitHub search; rotate immediately if exposed.
- **Use environment variables.** Pass via `COGNIA_API_KEY` to the SDK and MCP, or via secret managers (Vercel, Doppler, AWS Secrets Manager).
- **Rotate on schedule.** Cognia keys don't auto-expire; rotate every 90 days for SOC 2 / ISO 27001 alignment.

## Revoking

```sh
curl -X DELETE https://api.cognia.xyz/api/api-keys/<key_id> \
  -H "Authorization: Bearer <session_token>"
```

…or use the dashboard. Revocation is immediate; in-flight requests with the revoked key complete, but the next call returns `401`.
