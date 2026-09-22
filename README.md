# Compact

Private, mobile-first strength and fat-loss log for a single owner. Built with
Next.js (App Router, TypeScript), Prisma, and standards-based Web Push.

This implementation targets the same architecture as the brief (Next.js +
Supabase Postgres/Auth + Supabase Cron), but runs **fully locally** for now:
SQLite instead of Supabase Postgres, and a local `node-cron` scheduler instead
of Supabase Cron. See "Moving to Supabase / production hosting" below for what
changes.

## What's real vs. simulated

Everything in this app is a real, working feature against the local database —
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

```bash
npm install
cp .env.example .env
# edit .env: set OWNER_EMAIL / OWNER_PASSWORD, generate SESSION_SECRET and
# SCHEDULER_SECRET, and generate a VAPID keypair (see .env.example)
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
- **Supabase is not wired up.** This runs on SQLite + a local scheduler. See
  below for the migration path.
- **Reschedule/skip controls only appear for occurrences that already exist**
  (today or the past, or a date you've already interacted with) — future days
  don't get a database row until they're reached, so there's nothing to
  skip/reschedule yet. This matches "not-yet-due work" in the brief but means
  you can't pre-skip a day far in the future.
- Progress charts are a minimal bar chart + accessible `<table>` fallback, not
  a full charting library.

## Moving to Supabase / production hosting

1. Create a Supabase project. In **Auth → Providers**, disable new-user and
   anonymous sign-ups (there is no registration UI in this app anyway, but the
   backend should refuse it too).
2. Swap the Prisma datasource in `prisma/schema.prisma` from `sqlite` to
   `postgresql`, point `DATABASE_URL` at the Supabase connection string, and
   re-run migrations.
3. Add Postgres RLS policies scoping every table to the single owner row (the
   app currently enforces ownership at the application layer via the session
   cookie + `requireOwnerId()`; RLS should be added as defense in depth before
   using the Supabase anon/browser client directly for anything).
4. Deploy to an HTTPS-capable Next.js host. Set all `.env.example` variables as
   real secrets in that host's environment config — **never** commit them.
5. Replace `npm run scheduler` with Supabase Cron (or the host's equivalent)
   calling `POST https://<your-domain>/api/jobs/reminders` every 5 minutes with
   header `x-scheduler-secret: <SCHEDULER_SECRET>`.
6. Regenerate a production VAPID keypair — don't reuse the one generated for
   local dev.
7. On an iPhone: install the app to the Home Screen, open it there (not a
   regular Safari tab), grant notification permission from the Settings page's
   "Enable notifications" button, and use "Send test" to confirm delivery
   while the app is closed.

## Data export / backup

Settings → Data export gives a full JSON export (all tables, schema-versioned)
and per-table CSV exports (daily logs, cardio logs, exercise sets). CSV cells
are escaped against spreadsheet formula injection. There is no automated
off-device backup job in this delivery — for SQLite, back up `prisma/dev.db`
directly; for Postgres/Supabase, use Supabase's own backup/restore tooling and
actually test a restore before relying on it.

## Reset

Settings → "Reset / delete data" requires typing `DELETE MY DATA` to confirm.
It clears logs, sessions, occurrences, push subscriptions, and disables
reminders, but keeps the owner account and returns you to first-run setup —
it does not delete the account itself.
