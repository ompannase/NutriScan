# NutriScan API v1

Base: `https://<worker>/api/v1`. JSON in/out. Success: `{ "ok": true, "data": ... }`. Error: `{ "ok": false, "error": { "code", "message", "retryAfterSec?", "details?" } }`.
Auth: `Authorization: Bearer <session token>` (30-day sessions, stored hashed). The user is always derived from the session; any user id sent by a client is ignored.

| Method & path | Auth | Limits | Purpose |
|---|---|---|---|
| `GET /health` | none | none | Status + which AI providers are configured/missing what |
| `POST /auth/register` | none | 5/hour/IP | Create account. Returns `accountKey` (shown once), `token`, `expiresAt` |
| `POST /auth/login` `{accountKey}` | none | 10/15 min/IP | New session |
| `POST /auth/logout` | required | n/a | Revoke current session |
| `GET /auth/me` | required | n/a | Account info |
| `POST /ai/chat` `{message, history?, context?}` | optional* | 20/h/IP, 60/h/user, global daily cap | Nutrition Q&A |
| `POST /ai/recipe` `{prompt, profile?}` | optional* | same | Recipe idea |
| `POST /ai/explain-score` `{breakdown, product?}` | optional* | same | Explains the deterministic score |
| `POST /ai/alternatives` `{product, profile?}` | optional* | same | Healthier alternative types |
| `POST /sync` `{deviceId, cursor, changes[≤25]}` | required | 600/h/user | Push changes + pull others' (see DATABASE.md) |
| `GET /account/export` | required | n/a | Download your server-held records (max 5000) |
| `DELETE /account` `{confirm:"DELETE"}` | required | n/a | Delete account, sessions and all records |

\* Required when `AI_REQUIRE_AUTH=true`.

Error codes: `VALIDATION_FAILED` 400, `INVALID_JSON` 400, `UNAUTHORIZED` 401, `INVALID_ACCOUNT_KEY` 401, `NOT_FOUND` 404, `PAYLOAD_TOO_LARGE` 413, `STORAGE_LIMIT` 413, `RATE_LIMITED`/`AI_RATE_LIMITED` 429 (+`Retry-After`), `AI_BLOCKED` 502, `AI_NOT_CONFIGURED`/`AI_UNAVAILABLE` 503, `AI_TIMEOUT` 504, `INTERNAL` 500. Stack traces and database errors are never returned.

Not implemented (by design): product lookup/search and scoring/comparison run on the device (Open Food Facts is called directly; scoring is local and deterministic), and profile/history are carried by `/sync` rather than separate endpoints.
