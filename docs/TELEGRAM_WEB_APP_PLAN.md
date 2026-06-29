# Telegram Web App Implementation Plan

Status: approved for implementation on `codex/update-matches-star-icon`.

## Product boundary

Telegram is Beajee's decision layer, not a second desktop product. The bot attracts
attention; the full-screen Web App owns stateful work.

```text
bot notification
      │ exact Web App intent
      ▼
Today → match decision → mutual confirmation → chat → call
      │
      └── You: goal · privacy · search · scheduling · agent setup
```

## Architecture

The existing `/telegram` route becomes a standard responsive Web App. A thin bridge
adds Telegram authentication, full-screen presentation, safe-area support, BackButton,
and haptics when available. Browser sessions use NextAuth and receive the same short-lived
owner token, so the UI and APIs remain identical in both hosts.

```text
Telegram initData ─┐
                   ├─ /api/telegram/auth ─ owner JWT
NextAuth session ──┘
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
          matches          chats/calls       settings
              │               │                │
              └──────── existing service layer ┘
```

No new database model is required. Existing `Owner`, `Agent`, `Match`, `Chat`,
`Message`, `MatchCall`, `ContextQuestionBatch`, and privacy/freshness state are authoritative.

## User surfaces

- **Today:** unresolved proposals, waiting confirmations, unread conversations,
  call actions, context freshness/check-ins, and a calm no-action state.
- **Matches:** proposed, matched, and dormant relationships; concrete reasoning;
  Meet/Not now; expandable agent reasoning; scheduling within the relationship.
- **Chats:** chat list, unread counts, message history, drafts, sending, recovery,
  and call entry points.
- **You:** networking goal, search status, excluded topics, booking link, agent status,
  and Telegram-first onboarding/setup instructions.

## Bot changes

- `/start` exposes one `Open Beajee` Web App action.
- Forum-topic setup is no longer promoted; existing topic records remain compatible.
- Match proposals are delivered directly to linked owners.
- New chat messages and call requests open the exact relationship context.
- Match cards contain one precise Review action rather than several stale callback buttons.
- Context check-ins remain conversational in the bot and surface as an action in Today.

## Failure handling

- Invalid/expired Telegram data: retry auth, then show Telegram/browser sign-in recovery.
- Owner without agent: show onboarding instead of an empty match list.
- Partial data fetch failure: keep navigation available and show a retryable state.
- Expired JWT: re-authenticate once and retry the failed request.
- Duplicate match/call/message action: disable while pending; backend remains authoritative.
- Stale screen after Telegram resume: refresh all summaries on visibility/focus.
- Chat draft/navigation interruption: persist per-match draft locally.

## Performance

- Load Today data in parallel from bounded endpoints.
- Match and chat lists return only summary data; message history loads for one chat.
- Poll only the active chat, and stop polling while hidden.
- Avoid images and external font dependencies in the Mini App shell.

## Test coverage

```text
AUTH
├── valid Telegram initData → JWT
├── valid web session → same JWT audience
└── missing identity → recoverable 401

MATCHES
├── list proposed/matched/dormant
├── owner-specific confirmation state
├── confirm → waiting/matched
├── not now → dormant
└── non-participant rejected

CHATS
├── list + unread count
├── open marks read
├── send message
├── archived/non-participant rejected
└── empty/error states

CALLS / SETTINGS / ONBOARDING
├── request/read call status
├── update goal/privacy/search/scheduling
├── create Telegram-first owner agent once
└── repeated onboarding remains idempotent

WEB APP
├── no internal Telegram header
├── four destinations
├── proposal decision journey
├── chat draft/send journey
├── onboarding guardrail
└── exact deep-link intent restoration
```

## Not in scope

- Public Feed inside Telegram.
- Raw agent logs.
- A global dates/calendar product.
- Model Advice entry points.
- Removing legacy Telegram topic rows from the database.
