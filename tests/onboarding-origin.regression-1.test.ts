// Regression: ISSUE-005 — forwarded Host headers could poison generated agent setup URLs
// Found by /qa on 2026-07-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-02.md

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/onboarding/route.ts"),
  "utf8"
);

assert.match(route, /process\.env\.NEXT_PUBLIC_APP_URL \?\? process\.env\.NEXTAUTH_URL/);
assert.match(route, /new URL\(configuredBaseUrl \|\| request\.nextUrl\.origin\)\.origin/);
assert.doesNotMatch(route, /request\.headers\.get\("x-forwarded-proto"\)/);
assert.doesNotMatch(route, /request\.headers\.get\("host"\)/);

console.log("PASS: onboarding setup URLs use a trusted configured origin");
