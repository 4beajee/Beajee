# Context Question Batches

## Goal

Improve match quality with short, verified context check-ins without turning Codex
or Claude Code into notification surfaces.

## Delivery policy

```text
owner has linked Telegram
        |
        +-- yes --> deliver through the Beajee Telegram bot
        |
        +-- no  --> feature unavailable; show Telegram connect CTA
```

Telegram is the only delivery channel. No agent runtime, including OpenClaw,
Hermes, Codex, and Claude Code, receives context-question events.

## Batch lifecycle

```text
READY --deliver first question--> ACTIVE --answers/skips--> COMPLETED
   |
   +--expires----------------------------------------------> EXPIRED
```

A batch contains four standalone questions, presented one at a time. Each question
can be skipped without skipping the rest of the batch.

## Data flow

```text
weekly cron
  -> ContextQuestionService selects eligible owners
  -> creates one idempotent weekly batch per owner
  -> Telegram delivery
  -> owner answers or skips one question at a time
  -> after the last response, Telegram streams two ephemeral progress drafts
  -> answers are merged into the full context snapshot
  -> publish_context pipeline rebuilds embedding and retires stale beacons
```

On the DigitalOcean deployment, the host scheduler must call
`GET /api/cron/context-questions` with `Authorization: Bearer $CRON_SECRET` once
per week. The unique owner/cadence key makes retries safe.

## Telegram linking

The web app creates a short-lived, one-use token in `VerificationToken`. The user
opens `t.me/<bot>?start=sync_<token>`. The webhook hashes and consumes the token,
links the Telegram identity to the authenticated web owner, and merges an empty
Telegram-only placeholder owner when one exists. A Telegram identity already linked
to a real owner is rejected.

## What already exists

- Telegram identity, Mini App authentication, personal topics, bot callbacks, and
  owner-topic delivery provide the Telegram transport.
- `publishContext` owns privacy synchronization, embeddings, freshness, beacon
  invalidation, and analytics; approved answers must reuse it.
- Agent platform selection and platform-specific setup generation exist, but the
  onboarding UI currently hardcodes OpenClaw.

## Failure handling

| Failure | Handling | User-visible result |
|---|---|---|
| Link token expired/reused | Reject without changing either owner | Bot asks user to restart sync |
| Telegram belongs to another real owner | Reject merge | Bot explains account is already linked |
| Telegram send fails | Keep batch READY for retry | Dashboard remains not delivered |
| Duplicate cron execution | Unique owner/cadence key | No duplicate batch |
| User replies without active batch | Ignore as a question answer | Bot gives no misleading acknowledgement |
| Context publish fails | Keep completed answers pending internally | Delivery can be retried safely |
| Telegram is not linked | Batch is not created | App asks the owner to connect Telegram |
| Answer touches an excluded sensitive category | Omit it from the approved context | Exclusion remains enforced |

## Test plan

```text
Platform policy (unit)
  - every platform requires Telegram

Telegram linking (integration)
  - issue, consume, expire, reuse, collision, placeholder merge

Batch service (unit/integration)
  - eligibility, weekly idempotency, 4-question creation
  - sequential answers, per-question skip, expiry
  - automatic save after the final answer and publish failure retry

Delivery (integration)
  - immediate first question, per-question skip, free-text answers, and streamed completion states
  - no event is created for any agent without Telegram

UI (source assertions + QA)
  - platform selection during onboarding
  - Telegram CTA for unavailable platforms
  - connected/active state on Home and Settings

Prompts (contract tests)
  - all agent instructions explicitly prohibit context-question delivery
```

## Not in scope

- Folk CRM enrichment: explicitly outside the personal-networking product boundary.
- Arbitrary personal-life questionnaires: questions remain tied to match quality.
- More than two batches per week: cadence optimization needs real usage data.
- Native agent, research-preview, and custom daemon delivery: Telegram is the only
  supported check-in channel.
- Automatic publication before all questions are complete: the owner can skip any
  individual question, and only the completed batch is published.
