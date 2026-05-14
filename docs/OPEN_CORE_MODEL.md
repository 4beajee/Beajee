# Open Core Monetisation Model

> Gennety uses a **GitLab-style open core** strategy: the core platform is open source, advanced collaboration features are commercial.

## Model Overview

```
┌─────────────────────────────────────────┐
│         GENNETY OPEN CORE               │
├────────────────────┬────────────────────┤
│   OPEN SOURCE      │    COMMERCIAL       │
│   (MIT / AGPL)     │    (Proprietary)    │
├────────────────────┼────────────────────┤
│ Agent runtime      │ Teams (full)        │
│ Matching engine    │ Context Hub         │
│ Communities        │ Strategy Engine     │
│ Skill system       │ ModelsDebate        │
│ Onboarding         │ Analytics dashboard │
│ Self-hosted infra  │ Managed cloud SLA   │
│ Telegram bot core  │ Enterprise SSO      │
└────────────────────┴────────────────────┘
```

---

## Why Open Core?

1. **Distribution** — open source = free marketing, developer trust, community contributions.
2. **Self-hosters become advocates** — companies deploying Gennety internally spread the brand.
3. **Upsell path** — self-hosters hit limitations (no cross-network matching, no managed hosting) and upgrade to cloud.
4. **Defensibility** — the matching network effect is the real moat, not the code itself.

---

## Pricing Tiers (Draft)

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | Communities, basic matching, 1 agent, Telegram bot |
| **Pro** | $12/mo per user | Teams (up to 20 members), Context Hub, Strategy Engine |
| **Business** | $49/mo per team | Unlimited members, ModelsDebate, priority matching, analytics |
| **Enterprise** | Custom | SSO, SLA, dedicated infra, custom LLM integration |
| **Self-Hosted** | Free (OSS) | All open-source features, own LLM keys, no cloud network |

---

## Comparison with Reference Models

| Company | Open Part | Commercial Part | Key Lesson |
|---|---|---|---|
| **GitLab** | CE (core DevOps) | EE (security, analytics) | Keep OSS genuinely useful |
| **Elastic** | Elasticsearch | Security, ML, SIEM | Don't over-restrict the core |
| **HashiCorp** | Terraform OSS | Terraform Cloud/Enterprise | Network effects live in cloud |
| **Gennety** | Agent + matching | Teams, Context Hub, cloud network | Network is the product |

---

## Licensing Strategy

- **Core (agent runtime, matching, communities):** AGPL-3.0
  - Ensures modifications stay open.
  - Forces SaaS forks to contribute back or purchase commercial license.
- **Commercial features (Teams, Context Hub, etc.):** Proprietary license
  - Not included in the public repo.
  - Available to cloud subscribers and Enterprise customers.
- **Self-hosted distribution:** Business Source License (BSL) option under consideration
  - Converts to AGPL after 4 years (HashiCorp-style, but cleaner).

---

## Revenue Model

```
Primary: SaaS subscriptions (Pro + Business + Enterprise)
Secondary: Marketplace (third-party agent skills / integrations)
Tertiary: Professional services (custom deployments for enterprises)
```

---

## Open Questions
- [ ] Finalise licence choice for core: AGPL vs. MIT (MIT is more permissive, faster adoption but easier to fork without contributing).
- [ ] BSL sunset period — 4 years or 3 years?
- [ ] Marketplace revenue share — 70/30 or 80/20?
- [ ] Free tier limits — how many matches/month before hitting a paywall?
