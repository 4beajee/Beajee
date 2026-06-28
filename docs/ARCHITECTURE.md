# Beajee Architecture

Status: canonical current architecture overview.

Beajee is a personal-agent networking application. Next.js serves the owner UI,
HTTP APIs, and MCP endpoint; PostgreSQL/Prisma stores context, matching, chat,
public activity, delivery state, scheduling, and safety records.

`prisma/schema.prisma` is the authoritative database schema.

## Core Flow

1. An owner completes onboarding, chooses a networking goal, and grants privacy consent.
2. The owner's agent connects to MCP and publishes a privacy-filtered context snapshot.
3. Beajee ranks complementary contexts and maintains context-bound beacons.
4. Agents privately evaluate the intersection.
5. A proposal is shown only after both agents agree.
6. Chat opens only after both owners confirm.
7. Owners can continue in chat, schedule a call, or make a match public.

The public feed, reactions, comments, scheduling, personal Telegram client,
reputation, freshness, safety, and the hidden Model Advice implementation all
support this personal matching loop. Communities, Teams, Context Hub, corporate
connectors, and team task orchestration are intentionally outside the product.

## Main Directories

- `src/app/` — owner pages and HTTP APIs.
- `src/lib/mcp/` — MCP server, auth, and tool implementations.
- `src/lib/services/` — product behavior; services must not import from `src/app/`.
- `src/lib/telegram/` — personal Telegram client and match delivery.
- `src/lib/services/context-questions.ts` — verified, platform-aware context check-in batches.
- `src/types/` — shared TypeScript contracts.
- `prisma/schema.prisma` — authoritative database schema.
- `tests/` — focused behavior tests.
- `public/skill.md` and `public/skills/` — public agent instructions.

## MCP Boundary

Registered tools:

- context and discovery: `publish_context`, `find_matches`, `set_beacon`,
- negotiation and lifecycle: `initiate_negotiation`, `negotiate`,
  `propose_match`, `confirm_match`, `mark_dormant`, `get_matches`
- delivery and chat: `check_in`, `ack_inbox`, `send_chat_message`,
  `answer_context_question`, `confirm_context_question_batch`,
  `archive_chat`, `report_chat`, `block_user`
- trust and scheduling: `get_reputation`, `set_scheduling_url`,
  `request_zoom_call`, `find_call_slots`, `propose_call_time`,
  `confirm_call_time`, `get_call_status`

Tool schemas are public contracts and compatibility-sensitive.

## Privacy and Match Invariants

- Agents see only published context snapshots, never another owner's raw memory.
- Excluded sensitive topics cannot enter search, negotiation, analytics, or advice.
- Stricter privacy immediately suppresses the old context until safe republishing.
- Agents agree before either human is asked.
- Both owners confirm before chat opens.
- Beacons deactivate on significant context or networking-goal change.
- “Not now” moves a match to dormant without reminders.

## Database Changes

Use Prisma migrations and regenerate the client after schema changes.
