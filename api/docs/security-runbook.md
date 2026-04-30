# Security Runbook

This document describes the operational behavior of Cognia's security middleware and the procedures for incident response.

## Fail-closed semantics

All security middleware (`require-2fa`, `session-timeout`, `ip-allowlist`, and the generic `rate-limit`) returns `503 SECURITY_CHECK_UNAVAILABLE` when its dependencies (Redis, Prisma) are unreachable.

This is intentional. Failing open silently lets a bad actor bypass security policies during a transient outage; failing closed surfaces the outage immediately.

### Verifying fail-closed

Stop Redis (`docker compose stop redis`), then hit any rate-limited endpoint (`POST /api/auth/login` with any body):

```
HTTP/1.1 503 Service Unavailable
{"message":"Rate limiter temporarily unavailable. Please retry.","code":"SECURITY_CHECK_UNAVAILABLE"}
```

Restart Redis (`docker compose start redis`) and retry — should return the normal 200/401.

### Breakglass override

For genuine production incidents where security checks are blocking traffic and triage requires fail-open temporarily, set:

```
SECURITY_FAIL_OPEN_BREAKGLASS=true
```

and restart the API. With this set, the same middlewares log a WARN and call `next()` instead of returning 503.

**Constraints on breakglass use:**

1. Engage only during an active incident with a recorded incident ID.
2. Unset and restart the moment the underlying issue is resolved.
3. Every breakglass engagement is logged at WARN level. Track in the incident review.
4. Breakglass does NOT bypass the 503 from `helmet`/CORS or other Express failures; it only flips security middleware to fail-open.

## JWT session model

After Phase 0:

- Access JWT TTL: configurable via `JWT_EXPIRES_IN` (default 15m as documented in `.env.example`).
- Refresh token TTL: 14 days (configurable via `REFRESH_TOKEN_EXPIRES_IN_DAYS`).
- Each access JWT carries a `jti` claim (UUID).
- Refresh tokens are opaque 64-hex strings, hashed in the DB (`refresh_tokens.token_hash`), with rotation and reuse detection.

### Revocation

| Endpoint                                 | Effect                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/logout`                  | Revokes the current token's `jti`. Clears cookies. Requires the access token.                                                                   |
| `POST /api/auth/logout-all`              | Revokes every JWT issued for the current user (via the `revoke-since` floor) AND revokes all refresh-token families. Requires the access token. |
| `POST /api/auth/sessions/:userId/revoke` | Same as `/logout-all` but for an arbitrary user. Admin-only. Use to forcibly log out a fired employee, compromised account, etc.                |

### How revocation works

- **Per-token**: `jwt:revoked:jti:<uuid>` Redis key with PX TTL = remaining JWT lifetime. Auth middleware checks this on every request.
- **Per-user**: `jwt:revoked:user:<uuid>` Redis key holding a unix timestamp. Auth middleware compares the token's `iat` against this floor; tokens issued at or before are rejected.
- **Refresh family**: `refresh_tokens.revoked_at` is set. The `/auth/refresh` endpoint rejects revoked or used rows. **Reuse** of a previously-rotated token revokes the entire family — this catches stolen refresh tokens.

### Refresh-token reuse detection

When `/auth/refresh` is called with a token whose `used_at` is already set, the service:

1. Logs a WARN with `userId` + `familyId`.
2. Calls `revokeFamily(familyId)`, which marks every token in that lineage as revoked.
3. Returns `401 Refresh token reuse detected` to the caller.

If you see these warnings in production, investigate: a token was either stolen and replayed by an attacker, OR a client bug double-spent a refresh.

## 2FA secrets

Stored in `users.two_factor_secret` AES-256-GCM-encrypted with `TWO_FACTOR_ENCRYPTION_KEY`. Rows have an `enc:v1:` prefix.

**Dual-read pattern**: legacy plaintext rows (no prefix) are still readable; on the next successful TOTP verify on a legacy row, the value is opportunistically re-encrypted in place.

**Rotation procedure** (until KMS lands in Phase 6):

1. Generate a new key: `openssl rand -hex 32`.
2. Run the backfill script: `npm run backfill:2fa` (with the _new_ key as `TWO_FACTOR_ENCRYPTION_KEY`). Note: this only re-encrypts legacy rows. To rotate already-encrypted rows you need a two-key rotation strategy — defer to Phase 6 (proper KMS integration).
3. Deploy the new key.

**Backfill script**: `npm run backfill:2fa` — reads every user with 2FA enabled and a non-null secret, encrypts any legacy rows. Idempotent.

## Integration tokens (Slack, Drive, Notion, Box)

Stored encrypted with `TOKEN_ENCRYPTION_KEY` via `@cogniahq/integrations`'s `createTokenEncryptor`. The application **refuses to boot** if the key is unset — this is the safest default. A boot like:

```
FATAL: TOKEN_ENCRYPTION_KEY is not set. Application cannot start without an integration token encryption key.
```

means you forgot to set the env var, not that the app is broken.

## Helmet headers

Applied via `applySecurityHeaders(app)` in `src/App.ts` BEFORE `cors()` and routes:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; ...`

CSP can break inline scripts. If a customer reports broken UI after a deploy, check the browser console for CSP violations and either:

1. Adjust the directive in `security-headers.middleware.ts`, OR
2. Move the inline script into a hashed/static file.

There is no `SECURITY_DISABLE_CSP` env var — adjust the directive directly.

## Rate limits (after Phase 0)

| Limiter                      | Window | Max | Key            |
| ---------------------------- | ------ | --- | -------------- |
| `loginRateLimiter`           | 15 min | 5   | per-IP         |
| `registerRateLimiter`        | 60 min | 3   | per-IP         |
| `extensionTokenRateLimiter`  | 15 min | 10  | per-IP         |
| `searchRateLimiter`          | 60 sec | 60  | per-user-or-IP |
| `exportRateLimiter`          | 60 min | 5   | per-user-or-IP |
| `integrationSyncRateLimiter` | 60 sec | 30  | per-user-or-IP |

The `userOrIpKey` extractor uses `u:<userId>` when authenticated and `ip:<addr>` otherwise. The two namespaces never collide.

## Password breach check

`POST /api/auth/register` and `POST /api/auth/change-password` call `validatePasswordWithBreachCheck`, which runs the existing policy first, then queries HaveIBeenPwned via k-anonymity (`https://api.pwnedpasswords.com/range/<5-hex>`).

The password never leaves the API. HIBP unreachability is fail-open with a WARN log: signup completes, but security review should flag the warning.

Override the HIBP host via `HIBP_API_BASE` (used by tests). Default is `https://api.pwnedpasswords.com`.

## Audit log coverage (Phase 0 baseline)

The `audit_logs` table receives entries on:

- `login_success` — successful login
- `login_failed` — wrong password or wrong 2FA (only when the user record was found; unknown-email attempts are NOT logged in Phase 0 because `user_id` is NOT NULL on the schema. Phase 1 makes this nullable.)
- `logout` — single-token revoke
- `session_revoked` — `/logout-all` (self) or `/sessions/:userId/revoke` (admin)
- `2fa_enabled` / `2fa_disabled` / `backup_codes_regenerated`
- `password_changed`

These are user-scoped only. Org-scoping arrives in Phase 1 via the `organization_id` column.

## Incident playbook (forced logout)

A user reports their account is compromised:

1. Reset their password (admin tool / DB).
2. Hit `POST /api/auth/sessions/:userId/revoke` with an admin token. This:
   - Sets a JWT revoke-floor for that user → all access tokens issued before now are rejected on the next request.
   - Marks every refresh token for that user as revoked → can't refresh either.
3. Confirm by inspecting `audit_logs` for the `session_revoked` event.
4. If the compromise was a phishing reuse, also disable + re-enroll 2FA.

## Incident playbook (Redis outage)

1. Confirm Redis is down: `docker compose ps redis`.
2. Decide: is the outage <5 minutes? If yes, leave fail-closed. The user-visible 503s are correct behavior.
3. If outage is longer and triage requires traffic flow:
   - Set `SECURITY_FAIL_OPEN_BREAKGLASS=true` on the API instances.
   - Restart.
   - **Document the engagement** in your incident channel.
4. Restore Redis. **Unset breakglass and restart** the moment Redis is healthy.
5. Post-incident: confirm rate limiters are responding normally; check audit log for the WARN entries from breakglass; review.
