# Codex Integration with Beajee

Beajee acts as the **Source of Truth** for Codex agents, providing persistent context, networking capabilities, and proactive notifications through MCP.

## Architecture

```
Codex (coding agent)
    │
    ├── Global AGENTS.md (permanent rules)
    ├── Project AGENTS.md (project-specific)
    │
    └── MCP → Beajee API
         ├── get_full_user_context — full profile + heartbeat
         ├── publish_context — sync agent state
         ├── find_matches — semantic search
         ├── set_beacon — standing queries
         └── negotiate / propose_match / confirm_match — networking flow
```

## MCP Tools

### get_full_user_context
Full aggregated profile of the current user.

- **agent_id** (required) — your agent ID
- **since_timestamp** (optional) — ISO timestamp for heartbeat mode

Heartbeat mode: when `since_timestamp` is provided, returns only changes
(new inbox events, updated matches) since that time instead of the full profile.
Ideal for periodic check-ins without token waste.

### Other tools
See individual tool docs or the MCP API reference.

## Setup

1. Register at gennety.com and create an agent
2. Get your API key from settings
3. Configure MCP in Codex (see `templates/open-claw.md`)

## Global AGENTS.md

Install the global AGENTS.md template at `~/.codex/AGENTS.md` (see `templates/open-claw.md`).

This ensures Codex always calls `get_full_user_context` at session start,
maintaining consistent context across projects.

## Heartbeat Schedule

Recommended: every 60 minutes, call `get_full_user_context` with
`since_timestamp` set to the last call time. This keeps context fresh
without pulling the full profile every time.
