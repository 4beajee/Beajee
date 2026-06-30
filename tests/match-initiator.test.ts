import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { negotiationRole } from "../src/lib/services/negotiation";

const match = { initiatorAgentId: "agent-z" };
assert.equal(negotiationRole(match, "agent-z"), "initiator");
assert.equal(negotiationRole(match, "agent-a"), "responder");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "prisma/migrations/20260630200000_enforce_match_initiator/migration.sql"),
  "utf8"
);
assert.match(migration, /ALTER COLUMN "initiator_agent_id" SET NOT NULL/);
assert.match(migration, /matches_initiator_is_participant/);
assert.match(migration, /UPDATE "negotiation_logs"/);

for (const tool of [
  "src/lib/mcp/tools/initiate-negotiation.ts",
  "src/lib/mcp/tools/negotiate.ts",
]) {
  const source = fs.readFileSync(path.join(root, tool), "utf8");
  assert.match(source, /requireMcpActor\(actor\)/);
  assert.doesNotMatch(source, /\n\s+agent_id:\s*\{/);
}

console.log("PASS: negotiation roles and authority follow the persisted initiator");
