import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getContextQuestionDeliveryMode,
} from "../src/lib/agent-platform";
import {
  buildContextQuestions,
  getQuestionCadenceKey,
  isExcludedSensitiveAnswer,
} from "../src/lib/context-questions";

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

{
  for (const platform of ["open_claw", "hermes", "nano_claw", "codex", "claude_code", "manus", "folk", "cursor", "other_mcp"]) {
    assert.equal(getContextQuestionDeliveryMode(platform, false), "telegram_required");
    assert.equal(getContextQuestionDeliveryMode(platform, true), "telegram");
  }
  ok("Every platform requires Telegram for context check-ins");
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
  assert.match(questions[0].prompt, /Что сейчас сильнее всего тормозит/);
  assert.equal(questions.filter((question) => question.followUpPrompt).length, 0);
  assert.equal(questions.every((question) => /[А-Яа-яЁё]/.test(question.prompt)), true);
  ok("A batch contains four standalone Russian questions without follow-ups");
}

{
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
  const telegramWebhook = fs.readFileSync(
    path.join(ROOT, "src/app/api/telegram/webhook/route.ts"),
    "utf8"
  );
  const telegramTopics = fs.readFileSync(
    path.join(ROOT, "src/lib/telegram/topics.ts"),
    "utf8"
  );
  assert.match(onboarding, /ONBOARDING_AGENT_PLATFORMS\.map/);
  assert.doesNotMatch(onboarding, /"fork"/);
  assert.match(onboarding, /ContextCheckInDelivery/);
  assert.match(settings, /ContextCheckInDelivery/);
  assert.match(home, /TelegramConnectCard/);
  assert.match(template, /\[context_question_setup\]/);
  assert.doesNotMatch(mcpRoute, /answerContextQuestionTool/);
  assert.doesNotMatch(mcpRoute, /confirmContextQuestionBatchTool/);
  assert.match(cronRoute, /isAuthorizedCronRequest/);
  assert.match(publicContextSkill, /only by the Beajee Telegram bot/);
  assert.match(telegramWebhook, /Обдумываю ответы/);
  assert.match(telegramWebhook, /Обновляю информацию в твоём профиле/);
  assert.match(telegramWebhook, /Профиль обновлён/);
  assert.match(telegramWebhook, /context_skip_question/);
  assert.doesNotMatch(telegramWebhook, /context_start/);
  assert.doesNotMatch(telegramWebhook, /context_save/);
  assert.match(telegramTopics, /sendRichMessageDraft/);
  assert.match(telegramTopics, /tg-thinking/);
  ok("Onboarding, Home, Settings, and generated agent instructions require Telegram delivery");
}

console.log(`\nAll context question tests passed (${passed} checks).`);
