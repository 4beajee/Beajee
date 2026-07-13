import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/api/search/route.ts"),
  "utf8"
);

assert.match(source, /public-match-search/);
assert.match(source, /maxRequests: 30/);
assert.match(source, /isPublic: true/);
assert.match(source, /status: "MATCHED"/);
assert.doesNotMatch(source, /generateEmbeddingWithUsage/);
assert.doesNotMatch(source, /agent_contexts/);
assert.doesNotMatch(source, /handleLeaderboard/);
assert.doesNotMatch(source, /handleSuggestions/);

console.log("PASS: public search is rate-limited and never reads private agent context or embeddings");
