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
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("claude_code"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("hermes"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("manus"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("folk"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("cursor"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("perplexity_personal_computer"));
  assert.ok(AGENT_PLATFORM_OPTIONS.includes("other_mcp"));
  assert.equal(AGENT_PLATFORM_OPTIONS.some((platform) => platform === ("fork" as never)), false);
  assert.equal(isOpenClawPlatform("zero_claw"), true);
  assert.equal(isOpenClawPlatform("codex"), false);

  ok("supported agent runtimes include personal agents, coding agents, and Claw variants");
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

  assert.match(codex, /^# OpenAI Codex/);
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
  const onboardingPage = fs.readFileSync(
    path.join(ROOT, "src/app/(app)/onboarding/page.tsx"),
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
  const platformLogo = fs.readFileSync(
    path.join(ROOT, "src/components/agent-platform-logo.tsx"),
    "utf8"
  );
  const invalidPlatformMigration = fs.readFileSync(
    path.join(ROOT, "prisma/migrations/20260702_remove_invalid_fork_platform/migration.sql"),
    "utf8"
  );

  assert.match(switchRoute, /apiKey: newApiKey/);
  assert.match(switchRoute, /credentialVersion: \{ increment: 1 \}/);
  assert.match(switchRoute, /tx\.oAuthAccessToken\.updateMany/);
  assert.match(switchRoute, /tx\.setupGrant\.updateMany/);
  assert.match(switchRoute, /wakeWebhookEnabled: false/);
  assert.match(switchRoute, /closeAgentWakeStreams\(agent\.id, "platform_changed"\)/);
  assert.doesNotMatch(settingsSchema, /agentPlatform:/);
  assert.match(settingsPage, /\/api\/settings\/agent-platform/);
  assert.match(settingsPage, /function ChangeAgentPlatformSection/);
  assert.match(settingsPage, /PRIMARY_AGENT_PLATFORMS\.map/);
  assert.match(onboardingPage, /ONBOARDING_AGENT_PLATFORMS\.map/);
  assert.match(onboardingPage, /<AgentPlatformLogo platform=\{platform\}/);
  assert.doesNotMatch(onboardingPage, /setStep\("install"\)/);
  assert.match(setupRoute, /isOpenClawPlatform\(platform\)/);
  assert.match(setupRoute, /\[mcp_servers\.beajee\]/);
  assert.match(setupRoute, /hermes mcp test beajee/);
  assert.match(setupRoute, /\.cursor\/mcp\.json/);
  assert.match(settingsPage, /isOpenClawPlatform\(settings\.agentPlatform\)/);
  assert.match(wakeStreamRoute, /reason === "platform_changed"/);
  assert.match(platformLogo, /\/agent-platforms\/folk\.webp/);
  assert.match(platformLogo, /\/agent-platforms\/openclaw\.svg/);
  assert.match(platformLogo, /\/agent-platforms\/hermes\.svg/);
  assert.match(platformLogo, /\/agent-platforms\/cursor\.svg/);
  assert.match(platformLogo, /\/agent-platforms\/perplexity\.png/);
  assert.equal(fs.existsSync(path.join(ROOT, "public/agent-platforms/folk.webp")), true);
  for (const asset of ["openclaw.svg", "hermes.svg", "cursor.svg", "perplexity.png"]) {
    assert.equal(fs.existsSync(path.join(ROOT, "public/agent-platforms", asset)), true);
  }
  assert.match(invalidPlatformMigration, /SET "agent_platform" = 'other_mcp'/);
  assert.match(invalidPlatformMigration, /WHERE "agent_platform" = 'fork'/);

  ok("the UI uses the side-effect-safe switch endpoint and setup stays platform-aware");
}

console.log(`\nAll ${passed} agent platform switch tests passed.`);
