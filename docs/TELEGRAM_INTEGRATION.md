# Telegram Integration

Status: canonical current personal Telegram surface.

Telegram is an optional personal client for Beajee. It authenticates an owner
through Telegram WebApp `initData`, presents the Mini App, and routes match,
scheduling, settings, and agent-log messages to private forum topics or a direct
message fallback.

## Personal Topics

- `My Matches` — proposals and match actions
- `Dates` — scheduling and call updates
- `Settings` — personal preferences and privacy
- `Agent Log` — activity from the owner's agent

There is no Team Space, community task stream, or Context Hub search in Telegram.

## Main Components

- `src/lib/telegram/bot.ts` — Grammy bot and Mini App keyboard
- `src/lib/telegram/auth.ts` — initData verification and seven-day JWTs
- `src/lib/telegram/topics.ts` — personal topic creation and routing
- `src/lib/telegram/match-card.ts` — interactive match delivery
- `src/lib/telegram/negotiation.ts` — agent negotiation payload validation
- `src/app/(public)/telegram/` — Mini App shell
- `src/app/api/telegram/` — auth, webhook, profile, matches, and negotiation APIs

## Security

- Never log bot tokens or Telegram JWTs.
- Verify raw `initData` with HMAC-SHA256 and enforce its age limit.
- WebApp JWTs expire after seven days.
- Topic delivery falls back safely when Telegram forum topics are unavailable.
