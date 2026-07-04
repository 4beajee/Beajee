import { spawnSync } from "node:child_process";
import path from "node:path";

const tests = [
  "tests/auth-security.test.ts",
  "tests/calendar-security.test.ts",
  "tests/agent-wake.test.ts",
  "tests/agent-wake-stream.test.ts",
  "tests/agent-search-pause.test.ts",
  "tests/agent-platform-switch.test.ts",
  "tests/context-questions.test.ts",
  "tests/context-question-workflow.test.ts",
  "tests/consent.test.ts",
  "tests/match-confirmation.test.ts",
  "tests/match-initiator.test.ts",
  "tests/matching-blocks.test.ts",
  "tests/model-advice.test.ts",
  "tests/model-router.test.ts",
  "tests/telegram-intelligram.test.ts",
  "tests/telegram-link.test.ts",
  "tests/telegram-connect-entry-points.test.ts",
  "tests/telegram-web-app.test.ts",
  "tests/daily-telegram-report.test.ts",
  "tests/scheduling-match.test.ts",
  "tests/social-profile.test.ts",
  "tests/match-call.test.ts",
  "tests/openclaw-operator.test.ts",
  "tests/founder-analytics.test.ts",
  "tests/monitoring.test.ts",
  "tests/networking-goal.test.ts",
  "tests/network-stats.test.ts",
  "tests/privacy-sync.test.ts",
  "tests/public-match-privacy.test.ts",
  "tests/sensitive-topics.test.ts",
  "tests/setup-credentials.test.ts",
  "tests/route-policy.test.ts",
  "tests/request-boundaries.test.ts",
  "tests/e2e-core.test.ts",
];

for (const testFile of tests) {
  console.log(`\n> ${testFile}`);
  const result = spawnSync(process.execPath, ["--import", "tsx", path.resolve(testFile)], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll test files passed.");
