# Compact

Private, mobile-first strength and fat-loss log for a single owner. Built with
Next.js (App Router, TypeScript), Prisma, and standards-based Web Push.

This implementation targets the same architecture as the brief: Next.js +
Postgres (Supabase's free tier) + Web Push. The one piece still standing in
for its production equivalent is the reminders cron: locally (and until you
wire up a hosted cron) it's driven by a `node-cron` script instead of Supabase
Cron. See "Deploying (free)" below.

## What's real vs. simulated

Everything in this app is a real, working feature against a real database —
there are no mocked screens or fabricated demo data:

- Auth is a real signed session cookie (JWT) checked on every page (`src/proxy.ts`)
  and every API route (`src/lib/auth.ts`). There is no public registration route.
- Web Push is real: real VAPID keys, a real service worker (`public/sw.js`), a
  real subscription flow, and a real send via the `web-push` library
  (`src/lib/push.ts`). **Not yet verified**: an actual iPhone Home Screen
  install + closed-app push delivery, since that requires a real device and a
  publicly reachable HTTPS deployment. Test that separately before relying on it.
- The reminders scheduler (`POST /api/jobs/reminders`) is a real endpoint with
  real idempotent dedup (logical key = owner + local date + rule type),
  real claim/expire/catch-up-window logic, and a real outbox/delivery table.
  Locally it's invoked by `npm run scheduler` (a `node-cron` loop) instead of
  Supabase Cron; the endpoint itself is what a hosted cron would call.
- Progression suggestions, weight trend math, and calendar/day-of-cycle mapping
  are pure, unit-tested functions (`src/lib/progression.ts`, `src/lib/trend.ts`,
  `src/lib/date.ts`) — see `npm test`.

## First-time setup

You need a free Supabase Postgres database first — see "Deploying (free)"
below if you don't have one yet, then:

```bash
npm install
cp .env.example .env
# edit .env: DATABASE_URL + DIRECT_URL from your Supabase project, plus
# OWNER_EMAIL / OWNER_PASSWORD, a SESSION_SECRET, a SCHEDULER_SECRET, and a
# VAPID keypair (see .env.example for how to generate each)
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run seed                # creates the one owner account + starter program
npm run dev
```

Open `http://localhost:3000`, sign in with `OWNER_EMAIL` / `OWNER_PASSWORD`,
and complete first-run setup (choose the local date for Day 1). Everything
else — goal, targets, starter routine, reminder time defaults — is already
seeded from the owner's reported information; first-run only asks for what
wasn't already known (start date, and later, push permission).

To exercise the reminders pipeline locally, run the scheduler in a second
terminal:

```bash
npm run scheduler
```

It calls `POST /api/jobs/reminders` with the `SCHEDULER_SECRET` header every
five minutes, the same contract a hosted cron would use.

## Tests

```bash
npm test    # vitest: calendar mapping, progression eligibility, trend math,
            # notification text/suppression rules
npm run lint
npm run build
```

Not automated in this delivery: Playwright/E2E flows (sign-in → start/log/
resume/finish → check-ins → plan edits → export), RLS-equivalent integration
tests beyond the manual curl checks below, and a real device push test. Manual
verification performed during development (via `claude-in-chrome` browser
automation against a running dev server):

- Sign-in redirect, first-run setup, Today/Plan/Progress/Settings render with
  the owner's real seeded profile (75 kg baseline shown as an undated
  reference, 2100 kcal / 150 g targets, 70 kg milestone, prior load references
  shown verbatim and unmerged).
- Started a real workout session, logged 3 sets (idempotent PUT, rest timer,
  Undo), finished it — correctly recorded as **PARTIAL** (1 of 6 exercises
  done), never silently marked COMPLETED.
- Progress page correctly showed "Not enough measurements yet" (no weight
  logged) and correctly listed the logged sets under the equipment label
  entered mid-session.
- `GET /api/export/csv` and `GET /api/jobs/reminders` correctly return 401
  without a session / scheduler secret; the reminders job correctly produced
  exactly one logical outbox row across two consecutive invocations
  (`already_failed` / no duplicate on the second call).
- Settings equipment/load config (`PATCH /api/exercises/:key`) persists to the
  database and does not affect historical logs.

## Known limitations / not yet done

- **Push on a real iPhone is unverified.** The WebKit/Apple requirements
  (Home Screen install, HTTPS, gesture-initiated permission request) are
  implemented per their documented contract, but only a real deployed HTTPS
  URL on a real device can confirm delivery while the app is closed.
- **No Playwright/E2E suite yet** — only Vitest unit tests for the
  deterministic logic, plus the manual browser pass above.
- **Supabase Cron is not wired up yet** — the app runs against real Supabase
  Postgres, but reminders are still driven by the local `node-cron` script
  until you point a hosted cron at `/api/jobs/reminders` (see below).
- **No Postgres RLS policies yet.** Ownership is enforced at the application
  layer (every route checks the session via `requireOwnerId()`), which is
  sufficient as long as only this app's server talks to the database. Add RLS
  before ever using the Supabase anon/browser client directly.
- **Reschedule/skip controls only appear for occurrences that already exist**
  (today or the past, or a date you've already interacted with) — future days
  don't get a database row until they're reached, so there's nothing to
  skip/reschedule yet. This matches "not-yet-due work" in the brief but means
  you can't pre-skip a day far in the future.
- Progress charts are a minimal bar chart + accessible `<table>` fallback, not
  a full charting library.

## Deploying (free)

Two free services, wired together: **Supabase** for Postgres, **Vercel** for
hosting. Both have generous free tiers with no credit card required for this
app's scale (one user, small tables).

### 1. Database — Supabase free tier

1. Create a project at supabase.com (free tier: 500 MB database, pauses after
   a week of inactivity — it wakes back up on the next request, just slowly).
2. In **Auth → Providers**, disable new-user and anonymous sign-ups (this app
   has no registration UI anyway, but the backend should refuse it too).
3. Go to **Project Settings → Database → Connection string**. Copy two URIs:
   - **Transaction pooler** (port 6543) → this is `DATABASE_URL`. Append
     `?pgbouncer=true` if it isn't already there.
   - **Direct connection** (port 5432) → this is `DIRECT_URL`, used only for
     running migrations.
4. Locally: put both into `.env`, then run:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```
   This creates the schema and your one owner account directly on Supabase —
   from then on, local dev and production point at the same database unless
   you deliberately create a second Supabase project for dev.

### 2. Hosting — Vercel free tier

1. Import the GitHub repo into Vercel (already connected, since that's the
   deployment that failed). Framework preset: Next.js — no changes needed.
2. In **Project Settings → Environment Variables**, add every variable from
   `.env.example` with real values: `DATABASE_URL`, `DIRECT_URL`,
   `SESSION_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `SCHEDULER_SECRET`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Generate a fresh VAPID keypair for
   production — don't reuse the one from local dev:
   ```bash
   node -e "console.log(require('web-push').generateVAPIDKeys())"
   ```
3. Redeploy. The `postinstall` script now runs `prisma generate` automatically
   as part of Vercel's build (this — plus SQLite — is why the first deploy
   failed: the Prisma client was never generated on Vercel's build machine).
4. On your phone: open the deployed HTTPS URL, "Add to Home Screen", open it
   from there, then Settings → "Enable notifications" → "Send test" to confirm
   push works while the app is closed.

### 3. Reminders cron — free options

Supabase Cron requires a paid compute add-on. Two free alternatives that call
the same endpoint on the same 5-minute contract:

- **cron-job.org** (free): a scheduled job that does
  `POST https://<your-vercel-domain>/api/jobs/reminders` every 5 minutes with
  header `x-scheduler-secret: <SCHEDULER_SECRET>`.
- **Vercel Cron** (included `vercel.json`, runs hourly on the free tier — the
  free plan doesn't allow every-5-minutes, so reminders land within the hour
  rather than within 5 minutes). Vercel auto-attaches
  `Authorization: Bearer <CRON_SECRET>` to cron requests, so set a
  `CRON_SECRET` env var in Vercel equal to the same value as
  `SCHEDULER_SECRET` — the endpoint accepts either that or the custom header.

Until one of these is set up, reminders simply won't fire in production —
everything else (Today/Plan/Progress/Settings, logging, export) works fully
without it.

## Data export / backup

Settings → Data export gives a full JSON export (all tables, schema-versioned)
and per-table CSV exports (daily logs, cardio logs, exercise sets). CSV cells
are escaped against spreadsheet formula injection. There is no automated
off-device backup job in this delivery — use Supabase's own backup/restore
tooling (Project Settings → Database → Backups) and actually test a restore
before relying on it; the free tier keeps daily backups for 7 days.

## Reset

Settings → "Reset / delete data" requires typing `DELETE MY DATA` to confirm.
It clears logs, sessions, occurrences, push subscriptions, and disables
reminders, but keeps the owner account and returns you to first-run setup —
it does not delete the account itself.
