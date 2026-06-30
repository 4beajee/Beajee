import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SensitiveContextError,
  assertContextRespectsExclusions,
  findSensitiveContextViolations,
  normalizeSensitiveTopics,
} from "../src/lib/sensitive-topics";

const violations = findSensitiveContextViolations(
  {
    current_work: "Building a developer tool",
    recent_problems: "Recovering after surgery while managing personal debt",
    expertise: ["TypeScript", "distributed systems"],
  },
  ["Health & personal issues", "Finances & debts"]
);
assert.deepEqual(violations, [
  {
    field: "recent_problems",
    categories: ["Health & personal issues", "Finances & debts"],
  },
]);

assert.throws(
  () =>
    assertContextRespectsExclusions(
      { looking_for: "Помощь из-за диагноза и тревожности" },
      ["Health & personal issues", "Psychological topics"]
    ),
  (error) =>
    error instanceof SensitiveContextError &&
    error.code === "SENSITIVE_CONTEXT_EXCLUDED" &&
    error.violations[0]?.field === "looking_for"
);

assert.doesNotThrow(() =>
  assertContextRespectsExclusions(
    { looking_for: "A business partner for a database project" },
    ["Personal relationships"]
  )
);

assert.deepEqual(normalizeSensitiveTopics(["健康与个人问题", "Health & personal issues"]), [
  "Health & personal issues",
]);

const root = path.resolve(__dirname, "..");
const contextIndex = fs.readFileSync(
  path.join(root, "src/lib/services/context-index.ts"),
  "utf8"
);
assert.ok(
  contextIndex.indexOf("assertContextRespectsExclusions(") <
    contextIndex.indexOf("generateEmbeddingWithUsage(embeddingText"),
  "privacy filtering must run before the embedding client"
);
assert.match(
  fs.readFileSync(path.join(root, "src/app/(app)/onboarding/page.tsx"), "utf8"),
  /value: "Health & personal issues", label:/,
  "localized onboarding labels must submit canonical category values"
);

console.log("PASS: excluded sensitive topics are rejected before embedding and persistence");
