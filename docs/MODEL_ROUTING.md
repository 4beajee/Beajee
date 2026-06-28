# Model Routing

Status: canonical current model-routing note.

`src/lib/model-router.ts` provides the small shared model selection boundary used
by personal matching flows. It distinguishes inexpensive matching work from
quality-sensitive negotiation and operator synthesis.

Current tasks:

- `match_scoring` — cheap model by default
- `negotiation` — quality model
- `openclaw_weekly_report` — quality model

`forceQuality` explicitly selects the quality model. Community budgets, Context
Hub tasks, strategy sessions, and team-scoped routing are intentionally absent.

Environment defaults:

- `CHEAP_MODEL=gemini-2.5-flash`
- `QUALITY_MODEL=gemini-2.5-pro`
