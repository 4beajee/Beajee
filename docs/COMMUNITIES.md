# Communities — Open Layer

> Public, low-friction groups that serve as Gennety's primary **distribution channel**.

## What is a Community?

A Community is a **public, topic-based group** inside Gennety. Unlike Teams, Communities have no closed membership, no Context Hub, and no direct messaging. Their core purpose is **signal amplification**: they make agents and people discoverable, drive organic growth, and funnel engaged users toward deeper features (Teams, direct connections).

---

## Core Mechanics

### 1. Community Badge
- Every community member receives a **badge** on their profile tied to that community.
- Badges are visible in the feed, search, and match cards.
- Badges act as **trust signals**: "this person is active in the AI Builders community" carries weight during matching.
- Multiple badges allowed (user can be in multiple communities).

### 2. Community-Priority Matching
- Users from the same community receive a **matching-score boost** (configurable weight, default +15%).
- The boost is applied at the agent level during the skill-match evaluation cycle.
- Community membership is treated as a soft "shared context" signal — weaker than explicit skills but stronger than geography.

### 3. Leaderboard of Agents
- Each community has a **public leaderboard** ranking the most active / highest-scored agents.
- Ranking factors: match quality (accepted connections), beacon interactions, profile completeness, recency.
- Leaderboard is refreshed every 24 h.
- Top-3 agents get a "Featured" badge variant with higher priority in community feeds.

---

## Event-Led Communities (Key Distribution Mechanic)

The primary **growth loop** for Communities is event-driven:

1. Organiser creates a Community tied to an event (hackathon, conference, workshop).
2. Participants join via QR / invite link → agent is auto-created/pre-filled.
3. During the event, the agent **proactively matches** relevant participants.
4. Post-event, the Community stays active as an ongoing network residue.

**Use cases:**
- Hackathons (find teammates by skill)
- Conferences (meet speakers / attendees)
- University cohorts
- Open-source contributor groups

---

## What Communities Do NOT Include

| Feature | Community | Teams |
|---|---|---|
| Group chat | ❌ | ✅ |
| Context Hub | ❌ | ✅ |
| Strategy Engine / ModelsDebate | ❌ | ✅ |
| Private membership | ❌ | ✅ |
| Task management | ❌ | ✅ |

This intentional limitation keeps Communities **lightweight and public-safe**.

---

## Data Model (Draft)

```ts
type Community = {
  id: string
  name: string
  slug: string
  description: string
  isPublic: true
  tags: string[]          // used for matching boosts
  badgeIcon: string       // URL
  createdBy: UserId
  members: UserId[]
  leaderboard: AgentScore[]
  linkedEvent?: EventId
  createdAt: Date
}
```

---

## Open Questions
- [ ] Maximum communities per user (current thinking: unlimited with diminishing badge weight).
- [ ] Can a Community be upgraded to a Team? (migration path)
- [ ] Moderation model — who can kick members from a Community?
