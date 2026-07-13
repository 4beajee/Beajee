// Regression: ISSUE-006 — app-domain prefetch followed the legal-page redirect across origins
// Found during QA on 2026-07-02

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const banner = fs.readFileSync(
  path.join(process.cwd(), "src/components/cookie-consent.tsx"),
  "utf8"
);

assert.match(banner, /process\.env\.NEXT_PUBLIC_LANDING_URL/);
assert.match(banner, /new URL\("\/cookie-policy"/);
assert.match(banner, /<a[\s\S]*href=\{cookiePolicyHref\}/);
assert.doesNotMatch(banner, /<Link[\s\S]*href="\/cookie-policy"/);

console.log("PASS: cookie policy navigation bypasses cross-origin Next.js prefetch");
