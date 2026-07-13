import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const beacon = read("src/lib/services/beacon.ts");
const privacySync = read("src/lib/services/privacy-sync.ts");
const contextIndex = read("src/lib/services/context-index.ts");

assert.match(beacon, /assertContextRespectsExclusions\(\{ context_query: normalizedQuery \}/);
assert.match(beacon, /Publish a current context before setting a beacon/);
assert.match(beacon, /a\.last_active_at > \$\{livenessCutoff\}/);
assert.match(beacon, /ac\.freshness_state NOT IN \('STALE', 'INACTIVE'\)/);
assert.match(beacon, /context_query_length: normalizedQuery\.length/);

assert.match(privacySync, /tx\.beacon\.deleteMany\(\{ where: \{ agentId: agent\.id \} \}\)/);
assert.match(contextIndex, /beacon_agent\.last_active_at > \$\{livenessCutoff\}/);
assert.match(contextIndex, /context_query_length: beacon\.context_query\.length/);
assert.doesNotMatch(contextIndex, /metadata:\s*\{\s*context_query: beacon\.context_query/);

console.log("PASS: beacons respect privacy exclusions, freshness, liveness, and analytics minimization");
