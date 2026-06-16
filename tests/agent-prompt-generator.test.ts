import assert from "node:assert/strict";
import { generateAgentOnboardingPrompt } from "../src/lib/onboarding/agent-prompt-generator";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

const baseParams = {
  agentId: "agent_test_abc",
  apiKey: "gny_test_key",
  ownerName: "Gleb",
  networkingGoal: "partnership" as const,
};

{
  const prompt = generateAgentOnboardingPrompt({
    ...baseParams,
    platform: "folk",
  });

  assert.match(prompt, /Connect to Beajee \(https:\/\/beajee\.com\)/);
  assert.match(prompt, /Docs: https:\/\/beajee\.com\/skill\.md/);
  assert.match(prompt, /mcp_endpoint: https:\/\/api\.beajee\.com\/mcp/);
  assert.match(prompt, /URL: https:\/\/api\.beajee\.com\/mcp/);
  assert.match(prompt, /https:\/\/app\.beajee\.com\/settings/);
  assert.match(prompt, /Folk may not fully support Beajee yet/);
  assert.doesNotMatch(prompt, /Gennety/);
  assert.doesNotMatch(prompt, /gennety\.com/);
  assert.doesNotMatch(prompt, /api\.gennety\.com/);

  ok("folk setup prompt uses Beajee URLs and no Gennety references");
}

{
  const prompt = generateAgentOnboardingPrompt({
    ...baseParams,
    platform: "manus",
  });

  assert.match(prompt, /Beajee/);
  assert.match(prompt, /https:\/\/api\.beajee\.com\/mcp/);
  assert.doesNotMatch(prompt, /Gennety/);
  assert.doesNotMatch(prompt, /gennety\.com/);

  ok("manus setup prompt uses Beajee branding");
}

console.log(`\nAll ${passed} agent-prompt-generator tests passed.`);