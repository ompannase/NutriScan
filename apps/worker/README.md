# NutriScan API (Cloudflare Worker)

Optional backend for NutriScan: AI assistant proxy, account-key sign-in, and multi-device sync.
The mobile app works fully offline without it.

## What you need (all free, no payment card)
| Need | Required? | Where |
|---|---|---|
| Cloudflare account | Yes, to deploy | https://dash.cloudflare.com/sign-up |
| AI key: Gemini **or** Groq | Only for real AI answers | https://aistudio.google.com/apikey, https://console.groq.com/keys |
| Model name for that provider | Yes, if you use it | Pick from the provider's *current* free-tier list (they change often) |

Without an AI key the API still runs: `/ai/*` returns `AI_NOT_CONFIGURED` and the app shows its offline guide.

## Local development
```bash
cd apps/worker
npm install
cp .dev.vars.example .dev.vars        # fill GEMINI_API_KEY + GEMINI_MODEL (or GROQ_*)
npm run db:migrate:local
npm run dev                           # http://localhost:8787
npm test                              # 43 tests, no keys or network needed
```
Android blocks plain `http://` in release builds, so for a real phone deploy to `workers.dev` (https) rather than pointing at a LAN address.

## Deploy
```bash
npx wrangler login
npx wrangler d1 create nutriscan                 # copy the printed database_id into wrangler.toml
npm run db:migrate:remote
# set model names in wrangler.toml [vars], e.g. GEMINI_MODEL = "<current free model>"
npx wrangler secret put GEMINI_API_KEY           # paste key when prompted (optional: GROQ_API_KEY)
npm run deploy
curl https://<your-worker>.workers.dev/api/v1/health
```
`/health` lists each provider and exactly what it is missing (never any secret value).

## Configuration (wrangler.toml `[vars]` / secrets)
`AI_PROVIDER`, `AI_FALLBACK_PROVIDERS` (comma list: `gemini,groq,pollinations,workersai`), `GEMINI_MODEL`, `GROQ_MODEL`,
`AI_REQUIRE_AUTH` (`true` = only signed-in users may use AI), `AI_TIMEOUT_MS`, `AI_DAILY_GLOBAL_LIMIT` (shared daily cap that protects your free quota).
Secrets: `GEMINI_API_KEY`, `GROQ_API_KEY`, `POLLINATIONS_API_KEY`.
Pollinations/Workers AI only activate if you configure them explicitly; nothing is routed to a third party by default.

## Layout
`src/routes` (auth, ai, sync, account, health) · `src/providers` (adapters, fallback chain, prompts) · `src/middleware` · `migrations/` · `test/`
