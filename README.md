# CAT Sprint

CAT 2026 planner (exam: **Sun 29 Nov 2026**). Next.js 16 · Drizzle · Neon · Auth.js (Google) · Web Push + WhatsApp (CallMeBot) · Qwen via OpenRouter.

## Local
```bash
cp .env.example .env.local   # DATABASE_URL=pglite:./.pglite works with zero setup
npx drizzle-kit push         # create tables
npm run dev                  # DEV_LOGIN=1 adds a local-only login; POST /api/dev/seed fills demo data
npm test
```
PGlite is single-process: stop `npm run dev` before running `drizzle-kit push`. If it ever corrupts: `rm -rf .pglite && npx drizzle-kit push`.

## Deploy (Vercel)
1. Push to GitHub → import in Vercel.
2. Env vars (Production): `DATABASE_URL` (Neon pooled URL), `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=qwen/qwen3.8-27b:free`, `AI_DAILY_BUDGET=45`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `APP_URL=https://<domain>`.
   Do NOT set `DEV_LOGIN`.
3. Google OAuth client → add `https://<domain>` origin and `https://<domain>/api/auth/callback/google` redirect.
4. cron-job.org → every 30 min, `GET https://<domain>/api/cron/tick`, header `x-cron-secret: <CRON_SECRET>`.

## How the coach works
Rules pick *when* and *what situation* (`src/lib/coach.ts`); Qwen only words it (cached, budgeted), with rule-based fallbacks.
Check-ins at 12, 3, 6, 8, 10 PM inside your study window: warn → escalate if ignored, "almost done" push, instant applause on completion, next-morning callout after a bad day.
Test: `curl -H "x-cron-secret: $CRON_SECRET" "$URL/api/cron/tick?force=way-behind"`.
