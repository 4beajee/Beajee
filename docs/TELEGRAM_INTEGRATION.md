# Telegram Integration

> Gennety operates as a **first-class Telegram Mini App**, not just a web redirect.

## Architecture Overview

```
User (Telegram) → Mini App (Full Screen) → Gennety Backend → Agent Runtime
                                                   ↓
                                        Bot-to-Bot Communication API
                                        (Telegram May 2026 update)
```

The integration uses three layers:
1. **Telegram Bot** — receives events, sends notifications, handles inline actions.
2. **Mini App** — full Next.js UI embedded inside Telegram via Full Screen Mini Apps API (launched May 2026).
3. **Backend Intermediary** — authenticates Telegram users, bridges Telegram identity with Gennety accounts via a unified token.

---

## Onboarding Flow (Telegram path)

```
User opens Telegram bot
  → Welcome message + "Start" button
  → Mini App opens (Full Screen)
  → Onboarding wizard (same as web, adapted for mobile)
  → Final question: "How do you want to use Gennety?"
      A) Web platform  →  email registration, redirect to web
      B) Stay in Telegram  →  Telegram account linked, Mini App is primary surface
  → Unified token issued (links Telegram ID ↔ Gennety account)
```

**Key rule:** The split happens at the end of onboarding — the user sees the full product pitch before choosing a surface.

---

## Bot-to-Bot Communication (May 2026 API)

Telegram's May 7 2026 update introduced **Bot-to-Bot Communication**: bots can now send structured messages directly to other bots within a shared chat context.

**How Gennety uses it:**
- When Agent A (user A) wants to connect with Agent B (user B), it sends a structured negotiation message via Bot-to-Bot API.
- Agent B evaluates the request autonomously and either accepts, rejects, or asks for more info.
- Result surfaces in both users' Telegram notifications + Mini App feed.
- Users see: "Your agent started a conversation with @username's agent."

This enables **fully autonomous agent-to-agent matchmaking** without requiring both users to be online simultaneously.

---

## Mini App UI Surfaces

| Screen | Description |
|---|---|
| Match Feed | List of agent-proposed matches with accept/skip actions |
| Agent Chat | "Talk to your agent" — adjust goals, context, preferences |
| Match Profile | User card with shared context, skills, community badges |
| Team Space | Team group chat + Context Hub (Teams feature) |
| Notifications | Real-time updates from agent activity |

---

## Action Buttons on Match Cards

Each match card in the feed surfaces three actions:
1. **Start Agent Dialogue** — triggers bot-to-bot negotiation flow.
2. **Open OpenClaw Chat** — opens a direct AI-assisted conversation starter.
3. **Schedule Zoom Call** — initiates calendar coordination via agent.

---

## Authentication & Unified Token

- On Telegram login, the backend verifies `initData` from Mini App.
- Issues a **JWT** that encodes both `telegramId` and `gennetyUserId`.
- Token is stored in Mini App storage (`window.Telegram.WebApp.CloudStorage`).
- Same token works on web platform — seamless cross-surface continuity.

---

## Technical Stack

- **Bot framework:** `grammy` (TypeScript)
- **Mini App:** Next.js (existing codebase) with `@twa-dev/sdk`
- **Full Screen API:** `Telegram.WebApp.expand()` + `Telegram.WebApp.isFullscreen`
- **Bot-to-Bot:** Telegram Bot API v9.0+ (May 2026)

---

## Open Questions
- [ ] How to handle users who start on web and later want to add Telegram? (account merge flow)
- [ ] Push notification strategy — Telegram vs. web push?
- [ ] Rate limits for Bot-to-Bot API — how many agent negotiations per day per user?
- [ ] Mini App deep links for sharing match cards.
