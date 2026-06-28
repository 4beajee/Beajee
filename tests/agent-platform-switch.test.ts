import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getRealtimeSetup,
  personalizeAgentInstructions,
} from "../src/lib/onboarding/agent-instructions";
import {
  closeAgentWakeStreams,
  createAgentWakeStream,
  getWakeStreamConnectionCount,
} from "../src/lib/services/agent-wake-stream";
import {
  AGENT_PLATFORM_OPTIONS,
  isOpenClawPlatform,
} from "../src/types/onboarding";

const ROOT = path.resolve(__dirname, "..");

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

{
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("open_claw"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("codex"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("manus"));
  assert.equal(isOpenClawPlatform("zero_claw"), true);
  assert.equal(isOpenClawPlatform("codex"), false);

  ok("supported agent runtimes include OpenClaw, Codex, Manus, and Claw variants");
}

{
  const template = [
    "# [agent_platform]",
    "Agent [agent_id] / [api_key] / [networking_goal]",
    "[excluded_topics]",
    "[realtime_setup]",
  ].join("\n");
  const codex = personalizeAgentInstructions({
    template,
    platform: "codex",
    agentId: "agent-1",
    apiKey: "secret",
    networkingGoal: "collaboration",
    excludedTopics: ["Finances"],
  });

  assert.match(codex, /^# Codex/);
  assert.match(codex, /authoritative delivery path/);
  assert.doesNotMatch(codex, /beajee-openclaw-bridge\.mjs/);
  assert.match(getRealtimeSetup("open_claw"), /beajee-openclaw-bridge\.mjs/);

  ok("generated instructions use the selected runtime and only Claw agents receive the bridge");
}

{
  const agentInternalId = `test-agent-${Date.now()}`;
  createAgentWakeStream({ agentInternalId, agentExternalId: "agent-test" });
  assert.equal(getWakeStreamConnectionCount(agentInternalId), 1);
  assert.equal(closeAgentWakeStreams(agentInternalId, "platform_changed"), 1);
  assert.equal(getWakeStreamConnectionCount(agentInternalId), 0);

  ok("switching platforms can immediately close the previous runtime's wake stream");
}

{
  const switchRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/settings/agent-platform/route.ts"),
    "utf8"
  );
  const settingsSchema = fs.readFileSync(path.join(ROOT, "src/types/settings.ts"), "utf8");
  const settingsPage = fs.readFileSync(
    path.join(ROOT, "src/app/(app)/settings/page.tsx"),
    "utf8"
  );
  const setupRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/setup/[agentId]/route.ts"),
    "utf8"
  );
  const wakeStreamRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/agent/wake/stream/route.ts"),
    "utf8"
  );

  assert.match(switchRoute, /apiKey: newApiKey/);
  assert.match(switchRoute, /wakeWebhookEnabled: false/);
  assert.match(switchRoute, /closeAgentWakeStreams\(current\.agent\.id, "platform_changed"\)/);
  assert.doesNotMatch(settingsSchema, /agentPlatform:/);
  assert.match(settingsPage, /\/api\/settings\/agent-platform/);
  assert.match(setupRoute, /isOpenClawPlatform\(platform\)/);
  assert.match(settingsPage, /isOpenClawPlatform\(settings\.agentPlatform\)/);
  assert.match(wakeStreamRoute, /reason === "platform_changed"/);

  ok("the UI uses the side-effect-safe switch endpoint and setup stays platform-aware");
}

console.log(`\nAll ${passed} agent platform switch tests passed.`);
