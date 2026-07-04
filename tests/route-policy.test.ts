import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APP_ASSET_PREFIXES,
  isPublicApiPath,
  matchesAnySegment,
  matchesSegment,
  PUBLIC_FILE_PREFIXES,
  PUBLIC_PAGE_PREFIXES,
} from "../src/lib/route-policy";

assert.equal(matchesSegment("/feed", "/feed"), true);
assert.equal(matchesSegment("/feed/match-1", "/feed"), true);
assert.equal(matchesSegment("/feedback", "/feed"), false);
assert.equal(matchesAnySegment("/feed/match-1", PUBLIC_PAGE_PREFIXES), true);
assert.equal(matchesAnySegment("/agent-platforms/folk.webp", PUBLIC_FILE_PREFIXES), true);
assert.equal(matchesAnySegment("/agent-platforms/folk.webp", APP_ASSET_PREFIXES), true);
assert.equal(matchesAnySegment("/sounds/notification.mp3", APP_ASSET_PREFIXES), true);
const proxySource = fs.readFileSync(path.resolve(process.cwd(), "src/proxy.ts"), "utf8");
assert.match(proxySource, /useSubdomainRouting = process\.env\.NODE_ENV === "production"/);
assert.match(proxySource, /!matchesAnySegment\(pathname, APP_ASSET_PREFIXES\)/);

for (const path of [
  "/api/auth/signin",
  "/api/feed",
  "/api/feed/match-1",
  "/api/mcp",
  "/api/setup/agent-1",
  "/api/consent",
  "/api/search",
  "/api/cron/liveness",
]) {
  assert.equal(isPublicApiPath(path), true, `${path} should have an explicit public classification`);
}

for (const lookalike of [
  "/api/feed-evil",
  "/api/mcp/extra",
  "/api/stats-secret",
  "/api/admin/analytics-evil",
  "/api/telegrammatic",
  "/api/setup-malicious",
]) {
  assert.equal(isPublicApiPath(lookalike), false, `${lookalike} must not inherit a prefix policy`);
}

console.log("PASS: route policy uses exact paths and segment boundaries");
