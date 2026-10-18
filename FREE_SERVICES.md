# Free services used by NutriScan

Checked 18 Oct 2026 against search results; **third-party sites were the main source for AI limits, so re-check each provider's own page before relying on a number.** Anything unverified is marked.

| Service | Role | Key? | Card? | Free-tier summary | India availability |
|---|---|---|---|---|---|
| **Open Food Facts** | Product data (called directly by the app) | No | No | Free, open data (ODbL). Requires a descriptive User-Agent; has per-IP rate limits (I recall ~100 req/min for product reads and ~10 req/min for search: **unverified**, see their API docs). | Unverified (public API, no known block) |
| **Cloudflare Workers + D1** | Backend + database | No (account) | No | Workers Free: 100,000 requests/day, **10 ms CPU per request**. D1 Free: 5M rows read/day, 100,000 rows written/day, 5 GB. D1 queries *fail* once a daily limit is hit (enforced since 1 Sep 2026). Resets 00:00 UTC. | Unverified |
| **Google Gemini API** | AI answers (preferred) | Yes | No | Free tier is not a trial, but Google no longer publishes a fixed table; your limits are in AI Studio (`aistudio.google.com/rate-limit`). Third-party reports range from ~20 to ~1,500 requests/day depending on model, so treat it as small and variable. **On the free tier Google may use your prompts to improve its products**; avoid sending anything sensitive. Model names churn (2.5 line scheduled to shut down 16 Oct 2026), so never hardcode one. | Unverified: check AI Studio for your account/region |
| **Groq** | AI fallback | Yes | No (Free plan) | Free plan with per-model limits at the *organisation* level (extra keys don't help); exact numbers on `console.groq.com/settings/limits`. Reported samples ~30 req/min, ~1,000 req/day, ~200k tokens/day on some models (third-party, may be stale). | Unverified |
| **Pollinations** | Optional AI | Unknown | Unknown | **Not verified.** Disabled unless you set base URL + model yourself. | Unverified |
| **Cloudflare Workers AI** | Optional AI, no extra key | No | No | Has a daily free allowance, but I did **not** verify the current size or models. Disabled unless you enable the `[ai]` binding and set `WORKERS_AI_MODEL`. | Unverified |
| **Google ML Kit text recognition** | On-device OCR | No | No | Runs on the phone, no quota, no upload. | n/a (on-device) |

## Practical consequences
- One shared Gemini/Groq key serves **all** app users, so the free quota is tiny. `AI_DAILY_GLOBAL_LIMIT` (default 500/day) and per-IP/per-user hourly limits prevent one user draining it. When exhausted, the app shows its offline guide.
- Sync costs D1 *rows written*: roughly 2-3 rows per changed record, so ~30-50k record changes/day across all users before D1 refuses writes.
- Workers Free allows only 10 ms CPU per request. That is why sign-in uses a high-entropy **account key** (fast SHA-256) instead of password hashing (PBKDF2/bcrypt would likely exceed 10 ms). I could not test CPU time on real Cloudflare from here.
- Prices/limits change. Verify before launch; do not enable paid plans by accident (nothing here requires one).

## Where to configure
Secrets and model names: `apps/worker/README.md`. App-side public values: `apps/mobile/.env.example`.
