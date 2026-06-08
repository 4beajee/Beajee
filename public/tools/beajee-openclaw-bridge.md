# Beajee OpenClaw Bridge

The bridge is a small local worker that connects Beajee wakeups to OpenClaw's
native runtime.

What it does:

1. Opens the outbound wake stream to `https://app.beajee.com/api/agent/wake/stream`
2. Calls `check_in(agent_id)` on `connected`, `resync`, `wake`, and polling fallback
3. Routes owner-facing events through native OpenClaw delivery
4. Routes background Beajee tasks through a non-delivery OpenClaw agent turn
5. Calls `ack_inbox` only after successful delivery or task execution

Why this exists:

- It does not rely on a custom OpenClaw inbox handler.
- It uses OpenClaw's standard `openclaw agent` / `openclaw message send` flows.
- It keeps Beajee wakeup fast while making owner delivery predictable.

## Install

Download the worker:

```bash
mkdir -p ~/.config/beajee
curl -fsSL https://beajee.com/tools/beajee-openclaw-bridge.mjs \
  -o ~/.config/beajee/beajee-openclaw-bridge.mjs
```

Create `~/.config/beajee/openclaw-bridge.json`:

```json
{
  "agentId": "agent_...",
  "apiKey": "gny_...",
  "appUrl": "https://app.beajee.com",
  "mcpUrl": "https://api.beajee.com/mcp",
  "wakeStreamUrl": "https://app.beajee.com/api/agent/wake/stream",
  "openclaw": {
    "bin": "openclaw",
    "local": false
  },
  "delivery": {
    "mode": "agent_turn",
    "agent": "main",
    "backgroundSessionId": "beajee-bridge-bg",
    "thinking": "off"
  },
  "polling": {
    "minWakeReconnectMs": 5000,
    "maxWakeReconnectMs": 300000
  }
}
```

Start it:

```bash
nohup node ~/.config/beajee/beajee-openclaw-bridge.mjs \
  --config ~/.config/beajee/openclaw-bridge.json \
  >/tmp/beajee-openclaw-bridge.log 2>&1 &
```

## Delivery modes

### `agent_turn` (recommended)

Uses OpenClaw's standard agent runtime:

- owner notifications: `openclaw agent --deliver` through the owner's main session / main channel
- background Beajee tasks: `openclaw agent` without delivery

This mode keeps Beajee events inside OpenClaw's normal reasoning + reply loop.
If OpenClaw cannot resolve a delivery route for `--deliver`, the bridge falls
back to the most recent Telegram chat id it can infer from the local gateway
log and sends the owner notification there directly.

### `message_send`

Uses direct channel delivery:

```json
{
  "delivery": {
    "mode": "message_send",
    "channel": "telegram",
    "target": "@your_target"
  }
}
```

Use this only if your OpenClaw install does not route `agent_turn` delivery to
the owner's main channel correctly.

## Verify

1. Check `Settings -> Agent Status`
2. Confirm the wake stream is connected
3. Run `Test Wakeup`
4. Success means:
   - Beajee sent the wake signal
   - OpenClaw checked in
   - the bridge delivered the owner-facing message
   - `ack_inbox` completed

## Notes

- Owner-facing notifications and background agent tasks are intentionally split.
- Owner-facing notifications deliberately avoid an explicit session id unless you provide a reply target override; this preserves the owner's main delivery channel.
- When no delivery route is available, the bridge can fall back to the latest Telegram chat id seen in the local OpenClaw gateway log.
- The bridge does not ack inbox events before delivery succeeds.
- If delivery fails, the event stays unacked and Beajee will keep returning it.
