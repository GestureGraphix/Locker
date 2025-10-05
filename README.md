# Locker

Locker is a Next.js 15 dashboard for collegiate student-athletes. It ships with Google Calendar two-way sync, public iCal ingestion, and coach vs athlete role-aware experiences backed by PostgreSQL + Prisma, tRPC, and NextAuth v5.

## Getting started

1. Install dependencies

```bash
pnpm install
```

2. Launch Postgres locally (or use the provided Docker compose file)

```bash
docker compose -f docker-compose.dev.yml up -d
```

3. Apply the Prisma schema and seed demo data

```bash
pnpm prisma db push
pnpm run db:seed
```

4. Start the dev server

```bash
pnpm dev
```

The dashboard is available at [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and populate the secrets before running locally or deploying to Vercel.

| Key | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth JWT/session encryption |
| `NEXTAUTH_URL` | Public base URL (used for Google Calendar webhooks) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client created in Google Cloud Console |
| `CRON_SECRET` | Shared secret for background cron jobs |
| `WEBHOOK_CHANNEL_TOKEN` | Token used to validate Google Calendar push notifications |

## Calendar & Roles

Locker keeps an internal `CalendarEvent` table that normalizes Google and iCal data so we can extend to Outlook or other providers in the future.

### Google Calendar two-way sync

- Athletes connect via **Account → Calendars → Connect Google Calendar**. Tokens are stored in the `GoogleCalendarToken` table.
- The backend uses Google sync tokens plus push notifications (`/api/calendar/webhook`) to avoid polling; a 15 minute cron can call `revokeExpiredWatchChannels` with the `CRON_SECRET` if a webhook fails.
- Coaches can create a single practice in `/api/calendar/create` and Locker fans it out into every athlete’s primary calendar.
- `/api/calendar/list` serves normalized, internal event IDs—no raw Google IDs leak to the UI.

### iCal ingestion

- Athletes paste any public `.ics` feed in **Account → Calendars** and Locker uses `node-ical` to parse recurring rules, timezones, and exclusions.
- Imports are idempotent (`uid + dtStart` unique constraint) and we show a summary of adds/updates/errors after every run.

### Role based access & RLS

- Users carry a `role` (`ATHLETE` or `COACH`) and `teamId` on the `User` table.
- Middleware injects `x-locker-*` headers and guards `/coach/*` routes from athletes.
- PostgreSQL row level security is enabled for `CalendarEvent` and `GoogleCalendarToken`. Each request sets session variables through Prisma helpers so leaked tokens can’t access another athlete’s data.
- tRPC exposes dedicated `athleteProcedure` and `coachProcedure` helpers and the seed script provisions one coach plus three demo athletes on the same team.

## Testing

```bash
pnpm test      # vitest unit + integration tests
pnpm run tsc   # type-check under strict mode
```

Tests mock Google APIs with MSW-style handlers and cover the node-ical importer. Add new suites under `tests/`.

## Deploying to Vercel

- Set the environment variables above in the Vercel dashboard.
- Configure the Google OAuth consent screen with the Vercel domain and webhook endpoint.
- Point your scheduled cron (or Vercel Cron Job) to `revokeExpiredWatchChannels` with the shared `CRON_SECRET` to refresh watch channels every 12 hours.
