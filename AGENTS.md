# AGENTS.md — Beajee

> Primary context document for coding agents.
> Read this file completely before writing code or making architectural decisions.

## Deployment Runbook

Production deploy instructions for the DigitalOcean droplet live in
[`deploy.md`](./deploy.md). The file is local/private and intentionally
gitignored because it contains server access details.

When the user asks to deploy, read `deploy.md` first and execute the requested
deployment autonomously. For the whole app use the full deploy flow. For named
files, folders, or feature areas use the partial deploy flow and rebuild the
container when application code changed.

The DigitalOcean droplet running Docker Compose behind nginx is the current
production target. Older Vercel references are not production instructions.

## Product Boundary

Beajee is an AI-powered personal networking platform where an owner's agent
proactively finds the right person at the right moment.

This is not a directory or search engine. The core is a context-driven mutual
matching system where personal agents evaluate and negotiate introductions
before either human is asked.

> The agent understands the owner's current context, finds a person with a
> concrete complementary intersection, negotiates with their agent, and asks
> one question: “Meet Alex?”

The product intentionally does not include:

- Communities or Teams
- Context Hub or shared team memory
- team roles, tasks, strategy sessions, or dynamic team instructions
- corporate Slack, Jira, or Confluence integrations
- GitHub, Notion, Linear, or Obsidian profile-enrichment connectors

Do not reintroduce these surfaces without a new explicit product decision.

The following supporting surfaces remain in scope:

- Public Feed, public matches, reactions, and comments
- scheduling, calendar availability, and Zoom calls
- personal Telegram Mini App and private personal topics
- reputation, freshness, liveness, safety, analytics, and demo validation
- Model Advice implementation, kept hidden from ordinary users until explicitly enabled

## Core Flow

1. Owner chooses a networking goal.
2. Owner grants global memory consent and reviews sensitive-topic exclusions.
3. Platform issues personalized agent instructions.
4. Agent publishes a structured, privacy-filtered context snapshot.
5. Agent searches the index or sets a context-bound beacon.
6. Two agents privately evaluate the concrete intersection.
7. Only mutual agent agreement creates a proposal for both humans.
8. Both owners confirm before chat opens.
9. Humans chat, schedule a call, or make the match public.

## Product Invariants

- MCP is the primary agent interface. Tool schemas and authentication are public contracts.
- Agents never see another owner's raw memory, only the published context snapshot.
- Excluded sensitive topics never enter search, negotiations, or generated advice.
- Stricter privacy immediately suppresses old context until safe republishing.
- Networking-goal changes re-score context and deactivate old-goal beacons.
- Agents must agree before humans receive a proposal.
- Both owners must confirm before chat opens.
- Beacons deactivate on significant context change.
- `check_in` is authoritative; SSE wake is signal-only and may be lost.
- Services under `src/lib/services/` must not import from `src/app/`.
- API routes return structured JSON unless intentionally serving pages or static docs.

## Match Quality

Propose when there is a specific, explainable intersection:

- the people see the same problem from complementary angles;
- one has a skill, resource, experience, or perspective the other lacks;
- the value can be stated in one concrete sentence.

Do not propose for broad similarity such as “both work in AI” or “both are
founders,” identical work without complementarity, or an intersection that
cannot be explained precisely.

## Beacon Lifecycle

```
significant context or networking-goal change
        ↓
publish_context
        ↓
old beacons deactivate
        ↓
new context is indexed
        ↓
waiting beacons are rechecked for relevance
```

Context is the source of truth. A beacon cannot outlive the context that created it.

## Architecture

```
PERSONAL AGENT CLIENTS
        │ MCP
        ▼
MCP SERVER
  context · discovery · negotiation · delivery · chat · scheduling
        │
        ├── outbound SSE wake signal
        └── check_in authoritative work retrieval
        ▼
SERVICE LAYER
  ContextIndex · MatchEngine · Beacon · Negotiation · Chat
  PrivacySync · Freshness · Reputation · Inbox · AgentDelivery
  Scheduling · Telegram · Analytics · Safety · DemoResponder
        ▼
PostgreSQL + pgvector
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript strict |
| Agent interface | Model Context Protocol |
| Database | PostgreSQL via Prisma |
| Vector search | pgvector |
| Auth | NextAuth.js |
| AI | OpenAI embeddings + Anthropic flows |
| Email | Resend |
| Telegram | Grammy + Telegram WebApp |
| i18n | next-intl |
| Deployment | Docker/self-hosted on DigitalOcean |

## Important Project Areas

```
prisma/
  schema.prisma
  migrations/

src/app/
  api/mcp/                    primary MCP endpoint
  api/onboarding/             owner onboarding
  api/setup/[agentId]/        agent installation and wake setup
  api/agent/wake/stream/      outbound SSE wake stream
  api/soul/[agentId]/         personalized instructions
  api/matches/                match lifecycle
  api/chats/ and api/chat/    chat and hidden Model Advice APIs
  api/feed/                   public feed, reactions, comments
  api/telegram/               personal Telegram auth and actions
  api/cron/context-questions/ weekly context check-in scheduling
  api/profile/                owner profile and calendar connection
  api/admin/ and api/cron/    analytics, safety, demo, lifecycle jobs
  api/admin/analytics/founder-weekly/ private read-only founder snapshot for Hermes

src/app/(app)/
  onboarding/
  home/
  activity/
  notify/
  matches/
  chats/
  chat/[matchId]/
  profile/
  settings/
    reconnect/[platform]/       post-switch reconnection instructions

src/app/(public)/
  feed/
  telegram/
  login/
  privacy/
  terms/
  cookie-policy/

src/lib/mcp/tools/
  context, matching, negotiation, delivery, chat, safety, and scheduling tools

src/lib/services/
  context-index.ts
  context-questions.ts
  match-engine.ts
  beacon.ts
  negotiation.ts
  chat.ts
  privacy-sync.ts
  model-advice.ts
  freshness.ts
  reputation.ts
  inbox.ts
  agent-delivery.ts
  agent-wake-stream.ts
  agent-wake.ts
  networking-goal-sync.ts
  match-call.ts
  calendar-slots.ts
  scheduling-match.ts
  owner-scheduling.ts
  owner-social-profile.ts
  social-profile-prompt.ts
  match-card-view.ts
  telegram.ts
  notification.ts
  daily-telegram-report.ts

src/lib/telegram/
  bot.ts
  auth.ts
  topics.ts
  match-card.ts
  negotiation.ts
```

## Database Schema

`prisma/schema.prisma` is authoritative.

| Area | Models / enums |
|---|---|
| Owner/auth | `Owner`, `Account`, `VerificationToken`, `OAuthAccessToken`, `SetupGrant`, `LoginAttempt`, `RateLimitBucket` |
| Agent/context | `Agent`, `AgentContext`, `ContextQuestionBatch`, `ContextQuestion`, related enums, `AgentType`, `IntegrationMethod`, `FreshnessState` |
| Discovery | `Beacon` |
| Matching | `Match`, `MatchStatus`, `MatchDiscoverySource`, `NegotiationLog` |
| Chat/advice | `Chat`, `Message`, `AdviceSession`, related enums |
| Scheduling | `MatchCall`, `MatchCallProposal`, related enums |
| Calendar | calendar-only `PersonalConnector` |
| Trust/safety | `Block`, `Report`, `ConsentLog` |
| Public feed | `MatchReaction`, `MatchComment`, `ReactionType` |
| Telegram | `TelegramTopic`, `TelegramTopicType` |
| Delivery | `InboxEvent` |
| Analytics/cost | `AnalyticsEvent`, `ComputeUsage` |
| Demo network | `DemoResponderLog`, `DemoAgentQuota` |

Calendar credentials continue using the generic `PersonalConnector` table only
because scheduling needs encrypted calendar access. Non-calendar enrichment
connectors and profile-patching event/audit models are removed.

Telegram topics are personal: `matches`, `dates`, `settings`, and
`agent_log`. There is no Team Space topic.

The user-facing Telegram bot and the private daily-statistics bot are separate.
`@gennety_alerts_bot` uses dedicated credentials and must never reuse the personal
bot token.

## MCP Tools

```typescript
publish_context({ agent_id, context })
find_matches({ agent_id, filters? })
set_beacon({ agent_id, context_query, networking_goal_filter? })
initiate_negotiation({ agent_b_id, intersection_observed?, proposed_framing_for_b? })
negotiate({ match_id, decision, ... })
propose_match({ match_id, ... })
confirm_match({ match_id })
get_matches({ agent_id?, status? })
get_context_status({ agent_id })
get_reputation({ agent_id? })
check_in({ agent_id })
ack_inbox({ agent_id, event_ids })
send_chat_message({ match_id, content })
report_chat({ match_id, reason })
block_user({ blocked_owner_id })
archive_chat({ match_id })
set_search_status({ agent_id, paused })
set_scheduling_url({ agent_id, scheduling_url })
set_social_profiles({ agent_id, linkedin_url?, twitter_url? })
request_zoom_call({ match_id })
find_call_slots({ match_id })
propose_call_time({ match_id, slots })
confirm_call_time({ match_id, proposal_id })
get_call_status({ match_id })
```

`publish_context` requires the `context` wrapper. A bare context object is
not the real schema.

## Human Screens

1. Onboarding — networking goal and privacy consent
2. Connect — generated setup instructions
3. Home / Activity — overview and agent-visible events
4. Notification — “Meet Alex?” with specific framing
5. Matches — proposed and active connections
6. Chats / Chat detail — after mutual confirmation
7. Profile / Settings — identity, agent credentials, privacy, scheduling, and post-switch agent reconnection
8. Public Feed — public matches, reactions, comments
9. Telegram Web App — full-screen Today, matches, chats, calls, onboarding, and personal settings

Model Advice code and APIs remain available but the ordinary user entry point
must stay hidden until the feature is explicitly enabled.

Context check-ins are Telegram-only: no agent runtime may deliver, answer, or
save them. They are unavailable until the owner links Telegram. Telegram asks four
standalone questions one at a time, permits skipping an individual question, and
publishes the resulting context automatically after the final response.

## Current Priorities

- Polish the personal end-to-end loop: onboarding → context → matching →
  negotiation → proposal → confirmation → chat.
- Improve match quality and the specificity of agent framing.
- Keep privacy, goal changes, freshness, reputation, inbox, and wake behavior reliable.
- Improve Public Feed, scheduling, calls, and personal Telegram as supporting surfaces.
- Keep code, Prisma, MCP schemas, SOUL/templates, public skills, and docs aligned.
- Add or run focused tests when behavior changes.
- Resist scope expansion into communities, team collaboration, or B2B workflows.

## Private Founder Analytics

`GET /api/admin/analytics/founder-weekly` is an owner-only, read-only integration for the founder's personal Hermes Agent. It uses the dedicated `FOUNDER_ANALYTICS_SECRET`, never `ANALYTICS_ADMIN_SECRET` or an agent API key. The response contains aggregate current-week, previous-week, and comparison data and must not expose emails, owner names, raw messages, negotiation logs, report narratives, or context text. It is not a user-facing product surface or public MCP tool. Setup and the fixed Hermes prompt live in `docs/HERMES_FOUNDER_ANALYTICS.md`.

## Auto-sync Rule

Update this file whenever a significant architectural change occurs: new or
removed models, services, MCP tools, or major product surfaces. Minor refactors,
comments, and formatting do not require an update.

## Public Agent Discovery

- `public/skill.md` is the public onboarding and MCP reference entry point.
- `public/llms.txt` lists agent capabilities and onboarding.
- `public/skills/` contains statically served context, matching, beacon,
  scheduling, and call skills.
- Root copies of public instruction files must remain aligned.

## SOUL and Agent Templates

`SOUL.md` and templates are instructions issued to end-user agents, not
instructions for coding agents. Read them before changing:

- `publish_context` schemas;
- negotiation behavior;
- onboarding and setup;
- beacon query formats;
- scheduling and call flows.

## Git and Change Discipline

The worktree may contain user changes. Preserve them and never revert unrelated
work. After each implemented feature, create a focused commit and push it unless
the user explicitly asks not to.

---

*Project: Beajee | Status: focused personal-networking core*
