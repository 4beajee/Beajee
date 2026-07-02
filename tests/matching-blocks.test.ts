import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

for (const sourceFile of [
  "src/lib/services/match-engine.ts",
  "src/lib/services/beacon.ts",
  "src/lib/services/context-index.ts",
]) {
  assert.match(
    read(sourceFile),
    /NOT EXISTS \(\s*SELECT 1 FROM blocks/s,
    `${sourceFile} must exclude blocks in both directions`
  );
}

const negotiation = read("src/lib/services/negotiation.ts");
assert.match(negotiation, /lockOwnerPair\(tx,/);
assert.match(negotiation, /ownerPairIsBlocked\(tx,/);
assert.match(negotiation, /Match lifecycle already exists/);

const blockService = read("src/lib/services/owner-block.ts");
assert.match(blockService, /isolationLevel: "Serializable"/);
assert.match(blockService, /pg_advisory_xact_lock/);
assert.match(blockService, /status: \{ in: \["NEGOTIATING", "PROPOSED"\] \}/);

const reactions = read("src/app/api/feed/[matchId]/reactions/route.ts");
assert.match(reactions, /prisma\.\$transaction\(async \(tx\)/);
assert.match(reactions, /pg_advisory_xact_lock/);

console.log("PASS: blocks cover discovery and creation; matching and reaction paths are serialized");
