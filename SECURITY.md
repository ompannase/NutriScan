# Security notes

**Implemented and tested** (`apps/worker/test`): server-side API keys only (never `EXPO_PUBLIC_*`); sessions verified server-side on every protected route; per-user isolation (tested: one user cannot read/overwrite another's records, client-sent ids ignored); account keys (120-bit) and session tokens stored only as SHA-256 hashes; zod validation on every body; request-size caps enforced while streaming; hashed-key rate limits on login/register/AI/sync plus a global AI cap; no stack traces or DB errors to clients; logs contain event names only (no bodies, keys, tokens, IPs); security headers; no CORS (native app only); session token kept in the OS keystore via `expo-secure-store`; AI prompts label product/profile text as data and strip tag characters to blunt prompt injection; account deletion and export.

**Honest limitations**
- Account-key sign-in has **no recovery**: lose the key, lose cloud access (local data remains). No email or password reset.
- Rate limiting by IP uses `CF-Connecting-IP`; determined abusers can still use many IPs. The shared AI quota is protected by a global daily cap, not by identity.
- Cloud data is not end-to-end encrypted (stored as plain JSON in your own D1 database).
- Prompts sent to Gemini/Groq leave your server; on Gemini's free tier Google may use them to improve products. The app shows what context is shared and sends only what the user enables.
- Not done: certificate pinning, root/jailbreak detection, Cloudflare WAF/Turnstile, dependency audit in CI (run `npm audit` / `pnpm audit` yourself), secret scanning in CI.
- Workers Free CPU/size/request limits apply (see FREE_SERVICES.md).
