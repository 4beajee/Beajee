/**
 * Scheduling link tests — run with:
 *   node --import tsx tests/scheduling-match.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildSchedulingDeliveryPayload,
  resolveInitiatorAndRecipient,
  resolveSchedulingRoles,
} from "../src/lib/services/scheduling-match";
import { normalizeSchedulingUrl, detectSchedulingProvider } from "../src/lib/scheduling-url";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

{
  const url = normalizeSchedulingUrl("https://cal.com/ada/30min");
  assert.equal(url, "https://cal.com/ada/30min");
  assert.equal(detectSchedulingProvider(url!), "cal.com");
  ok("accepts Cal.com booking URLs");
}

{
  assert.throws(
    () => normalizeSchedulingUrl("https://zoom.us/j/123"),
    /Cal.com or Calendly/
  );
  ok("rejects non-scheduling providers");
}

{
  const parties = resolveInitiatorAndRecipient({
    agentA: {
      id: "agent_a",
      owner: { id: "owner_a", name: "Ada", schedulingUrl: "https://cal.com/ada/30min" },
    },
    agentB: {
      id: "agent_b",
      owner: { id: "owner_b", name: "Ben", schedulingUrl: null },
    },
    initiatorAgentId: "agent_a",
  });
  const roles = resolveSchedulingRoles(parties);
  assert.equal(roles?.hostOwner.id, "owner_a");
  assert.equal(roles?.guestOwner.id, "owner_b");

  const guestPayload = buildSchedulingDeliveryPayload({
    ownerId: "owner_b",
    roles,
  });
  const hostPayload = buildSchedulingDeliveryPayload({
    ownerId: "owner_a",
    roles,
  });

  assert.equal(guestPayload.scheduling_role, "guest");
  assert.equal(guestPayload.partner_scheduling_url, "https://cal.com/ada/30min");
  assert.equal(hostPayload.scheduling_role, "host");
  assert.equal(hostPayload.partner_scheduling_url, null);
  ok("shares the initiator booking link only with the guest");
}

{
  const parties = resolveInitiatorAndRecipient({
    agentA: {
      id: "agent_a",
      owner: { id: "owner_a", name: "Ada", schedulingUrl: null },
    },
    agentB: {
      id: "agent_b",
      owner: {
        id: "owner_b",
        name: "Ben",
        schedulingUrl: "https://calendly.com/ben/intro",
      },
    },
    initiatorAgentId: "agent_a",
  });
  const roles = resolveSchedulingRoles(parties);
  assert.equal(roles?.hostOwner.id, "owner_b");
  assert.equal(roles?.guestOwner.id, "owner_a");
  ok("falls back to the recipient link when the initiator has none");
}

{
  const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /schedulingUrl\s+String\?/);
  assert.match(schema, /schedulingHostOwnerId/);
  assert.match(schema, /schedulingGuestOwnerId/);
  ok("Prisma schema stores owner booking links and match scheduling roles");
}

{
  const mcpRoute = fs.readFileSync(path.join(ROOT, "src/app/api/mcp/route.ts"), "utf8");
  assert.match(mcpRoute, /setSchedulingUrlTool/);
  ok("MCP route registers set_scheduling_url");
}

console.log(`\nAll ${passed} scheduling tests passed.`);