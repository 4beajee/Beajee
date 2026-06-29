# Telegram Integration

Status: canonical current personal Telegram surface.

Telegram is an optional personal client for Beajee. It authenticates an owner
through Telegram WebApp `initData` or an existing browser session and presents a
shared, full-screen mobile Web App. The bot is the notification and conversational
layer; the Web App owns stateful decisions, chats, calls, and personal settings.

## Web App Navigation

- `Today` — proposals, unread chats, call actions, check-ins, and context freshness
- `Matches` — proposed, active, and dormant relationships
- `Chats` — conversations after mutual confirmation
- `You` — goal, search status, sensitive-topic exclusions, scheduling, and agent state

Telegram-specific APIs are a thin bridge for authentication, fullscreen, safe areas,
BackButton, and haptics. Business state remains in the ordinary Beajee service layer.

## Legacy Personal Topics

Existing topic rows remain supported as a delivery fallback, but topic setup is no
longer promoted to users. New users interact with the bot DM and the Web App.

There is no Team Space, community task stream, or Context Hub search in Telegram.

## Main Components

- `src/lib/telegram/bot.ts` — Grammy bot and Mini App keyboard
- `src/lib/telegram/auth.ts` — initData verification and seven-day JWTs
- `src/lib/telegram/topics.ts` — personal topic creation and routing
- `src/lib/telegram/match-card.ts` — exact Web App match-review links
- Match, chat, and call notifications deep-link into their exact Web App context.
- `src/lib/telegram/negotiation.ts` — agent negotiation payload validation
- `src/app/(public)/telegram/` — full-screen shared mobile Web App
- `src/app/api/telegram/` — auth, onboarding, settings, matches, chats, calls, webhook, and negotiation APIs

## Security

- Never log bot tokens or Telegram JWTs.
- Verify raw `initData` with HMAC-SHA256 and enforce its age limit.
- WebApp JWTs expire after seven days.
- Topic delivery falls back safely when Telegram forum topics are unavailable.
