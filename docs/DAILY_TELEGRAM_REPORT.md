# Daily Telegram Statistics

The backend sends one simple daily report to the private `@beajee_alerts_bot`.
The report uses direct PostgreSQL counts only; it does not call an AI model.

## Metrics

- current non-demo registered accounts and registrations in the last 24 hours;
- current onboarded users;
- account deletions since this ledger was introduced and deletions in the last 24 hours;
- completed non-demo matches and completions in the last 24 hours;
- proposals awaiting owner decisions;
- active agent negotiations.

Deletion totals start from the deployment of this feature because deleted owners were
previously removed without a durable aggregate event.

## Isolation

The report requires `TELEGRAM_ALERTS_BOT_TOKEN` and `TELEGRAM_ALERTS_CHAT_ID`.
Before sending, the backend calls Telegram `getMe` and refuses any token that does not
belong to `@beajee_alerts_bot`. `TELEGRAM_BOT_TOKEN` remains exclusive to the
user-facing Beajee bot.

OpenClaw operator reports use their own optional credentials. Immediate registration
and search-status admin messages are no longer sent to Telegram.

## Scheduling

Call `GET /api/cron/daily-telegram-report` with
`Authorization: Bearer $CRON_SECRET` once per day. Repeated calls on the same
America/Los_Angeles calendar day are idempotent after a successful delivery.

The legacy Vercel manifest schedules this at `17:00 UTC`; the DigitalOcean host
scheduler is the production source of truth and should call the same endpoint daily.
