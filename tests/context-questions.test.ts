import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getContextQuestionDeliveryMode,
  supportsNativeContextQuestions,
} from "../src/lib/agent-platform";
import {
  buildContextQuestions,
  getQuestionCadenceKey,
  isExcludedSensitiveAnswer,
  shouldAskClarifyingQuestion,
} from "../src/lib/context-questions";

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

{
  for (const platform of ["open_claw", "hermes", "fork", "nano_claw"]) {
    assert.equal(supportsNativeContextQuestions(platform), true);
    assert.equal(getContextQuestionDeliveryMode(platform, false), "native_agent");
    assert.equal(getContextQuestionDeliveryMode(platform, true), "telegram");
  }
  for (const platform of ["codex", "claude_code", "claude_desktop", "custom"]) {
    assert.equal(supportsNativeContextQuestions(platform), false);
    assert.equal(getContextQuestionDeliveryMode(platform, false), "telegram_required");
    assert.equal(getContextQuestionDeliveryMode(platform, true), "telegram");
  }
  ok("Telegram wins globally and coding agents require Telegram");
}

{
  const questions = buildContextQuestions({
    currentWork: "Building privacy-safe matching for founders",
    expertise: ["product", "AI systems"],
    lookingFor: "design partners with dense professional networks",
  });
  assert.equal(questions.length, 4);
  assert.deepEqual(questions.map((question) => question.sequence), [10, 20, 30, 40]);
  assert.equal(new Set(questions.map((question) => question.topic)).size, 4);
  assert.match(questions[0].prompt, /privacy-safe matching/);
  assert.equal(questions.filter((question) => question.followUpPrompt).length, 2);
  ok("A batch contains four distinct, context-shaped themes and at most two follow-ups");
}

{
  assert.equal(shouldAskClarifyingQuestion("distribution"), true);
  assert.equal(
    shouldAskClarifyingQuestion("I need someone who has launched a paid developer product in Europe"),
    false
  );
  assert.equal(getQuestionCadenceKey(new Date("2026-06-28T12:00:00Z")), "2026-W26");
  assert.equal(getQuestionCadenceKey(new Date("2026-06-29T12:00:00Z")), "2026-W27");
  ok("Clarification and weekly idempotency rules are deterministic");
}

{
  assert.equal(
    isExcludedSensitiveAnswer("My medical diagnosis is affecting the launch", ["Health & personal issues"]),
    true
  );
  assert.equal(
    isExcludedSensitiveAnswer("I need a distribution partner for the launch", ["Health & personal issues"]),
    false
  );
  ok("Excluded sensitive answers remain outside the published matching context");
}

{
  const onboarding = fs.readFileSync(
    path.join(ROOT, "src/app/(app)/onboarding/page.tsx"),
    "utf8"
  );
  const settings = fs.readFileSync(path.join(ROOT, "src/app/(app)/settings/page.tsx"), "utf8");
  const home = fs.readFileSync(path.join(ROOT, "src/app/(app)/home/page.tsx"), "utf8");
  const template = fs.readFileSync(path.join(ROOT, "templates/open-claw.md"), "utf8");
  const mcpRoute = fs.readFileSync(path.join(ROOT, "src/app/api/mcp/route.ts"), "utf8");
  const cronRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/cron/context-questions/route.ts"),
    "utf8"
  );
  const publicContextSkill = fs.readFileSync(
    path.join(ROOT, "public/skills/skill-context.md"),
    "utf8"
  );
  assert.match(onboarding, /"open_claw", "hermes", "fork", "codex", "claude_code"/);
  assert.match(onboarding, /ContextCheckInDelivery/);
  assert.match(settings, /ContextCheckInDelivery/);
  assert.match(home, /ContextCheckInDelivery/);
  assert.match(template, /\[context_question_setup\]/);
  assert.match(mcpRoute, /answerContextQuestionTool/);
  assert.match(mcpRoute, /confirmContextQuestionBatchTool/);
  assert.match(cronRoute, /isAuthorizedCronRequest/);
  assert.match(publicContextSkill, /Codex and Claude Code must never display/);
  ok("Onboarding, Home, Settings, and generated agent instructions expose the delivery policy");
}

console.log(`\nAll context question tests passed (${passed} checks).`);
