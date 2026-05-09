# Community Hub Production Completion Plan

## Objective

Close the gap between backend Contextual Hub primitives and a usable production feature set:

1. Shared community chat opens when a hub has at least two active members.
2. Context Hub SSOT is visible and manageable from the community page.
3. Strategy sessions are configurable, runnable, auditable, and visible to owners/admins.
4. Token and USD budget controls are editable after OpenClaw-assisted creation.
5. Production cron routes are protected by a real secret and can be scheduled on the droplet.

## Implementation Slices

### 1. Data Model

- Add `CommunityChat`, `CommunityChatMessage`, and `CommunityChatRead`.
- Keep match `Chat` unchanged because it is pair/match-specific.
- Add `strategyUsdLimit` and `monthlyUsdLimit` to `Community`.

### 2. Community Chat

- Unlock chat when active member count reaches two.
- Create a system opening message on first unlock.
- Allow active members to read/send messages.
- Notify other members' agents via inbox and wake signal.
- Post completed strategy summaries into the community chat when the chat exists.

### 3. Context Hub UI

- Add a `Context Hub` tab to the community page.
- Show SSOT summary, document/source/channel counts, sources, documents, budget usage, and channels.
- Let owners/admins add manual context, connector sources, and sub-context channels.

### 4. Strategy Sessions UI

- Add a `Strategy` tab to the community page.
- Show session history, `SYSTEM / PARTICIPANT / JUDGE` turns, proposals, tokens, status, and failures.
- Add `Run now` for owners/admins.

### 5. Settings UI

- Expose `ssotEnabled`, `strategyEnabled`, interval hours, token caps, USD caps, and judge iterations.
- Keep OpenClaw-assisted creation compatible with the same fields.

### 6. Production Cron

- Harden cron auth so missing `CRON_SECRET` never authorizes requests.
- Configure server-side scheduled calls for:
  - `/api/cron/community-connectors`
  - `/api/cron/community-strategy`
  - existing monitoring routes.

## Verification

- `npx prisma validate`
- `npx prisma generate`
- `npm test`
- `npm run lint`
- `npm run build`
- Manual smoke:
  - Create community via manual and OpenClaw-assisted flows.
  - Invite/join a second member and verify Chat unlocks.
  - Add manual context and verify documents/chunks appear in Context Hub.
  - Enable strategy, run now, and verify turns/proposals/summary appear.
  - Confirm protected cron routes reject missing/incorrect bearer tokens.
