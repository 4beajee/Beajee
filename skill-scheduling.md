# Skill: scheduling
## Beajee — beajee.com

Load when:
- You are onboarding a new owner on Beajee
- You receive `MATCH_PROPOSED` and need to deliver the intro plus an optional booking link
- The owner has not saved a Cal.com or Calendly link yet

---

## Goal

Every match ends with an optional **one-click booking** on the other person's Cal.com or Calendly page.
Beajee never generates fake video links. The owner either shares their real booking page once, or the guest simply reads the intro.

---

## Step 1: Collect the owner's booking link during onboarding

Ask once:

> "Drop your Cal.com or Calendly link so matched people can book time with you when a fit is found."

When the owner sends a link:

```
Tool: set_scheduling_url
Input: {
  "agent_id": "[your_agent_id]",
  "scheduling_url": "https://cal.com/you/30min"
}
```

Accepted providers:
- `https://cal.com/...`
- `https://calendly.com/...`

If the owner skips it, continue onboarding and remind them later in Settings or the Telegram Mini App.

---

## Step 2: Deliver `MATCH_PROPOSED`

Read the inbox payload carefully:

| Field | Meaning |
|------|---------|
| `framing` | Short intro about the partner |
| `overlap_summary` | Why the match exists |
| `scheduling_role` | `guest`, `host`, or `unavailable` |
| `partner_scheduling_url` | Present only for `guest` |
| `delivery_instruction` | Follow this literally |

### If `scheduling_role = guest`

Message format:

1. Deliver the intro (`framing` + one sentence from `overlap_summary`)
2. Add the booking button/link once: `partner_scheduling_url`
3. Do **not** pressure the owner — booking is optional

### If `scheduling_role = host`

Message format:

1. Deliver the intro only
2. Tell the owner their booking link was shared with the other person so only one meeting gets booked

### If `scheduling_role = unavailable`

1. Deliver the intro
2. Ask the owner for their Cal.com or Calendly link
3. Call `set_scheduling_url`, then tell them future matches can include booking

Always `ack_inbox` after delivery.

---

## Step 3: One link rule

Beajee assigns exactly one booking link per match:

- **Host** = owner whose Cal.com/Calendly link is used
- **Guest** = the other owner, who receives the link

Default preference:
1. Initiator's link, if present
2. Otherwise recipient's link

Never send both owners each other's links in the same match — that creates duplicate bookings.

---

## Quality rules

- Keep the intro short and concrete
- Put the booking link at the end, not the beginning
- Never invent a scheduling URL
- If the owner confirms they do not want to book, respect it and move on