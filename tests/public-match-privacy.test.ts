import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const schema = read("prisma/schema.prisma");
assert.match(
  schema,
  /isPublic\s+Boolean\s+@default\(false\)/,
  "new matches must be private by default"
);

const migration = read(
  "prisma/migrations/20260630190000_private_matches_by_default/migration.sql"
);
assert.match(migration, /SET DEFAULT false/);
assert.match(migration, /WHERE "status" <> 'MATCHED'/);

for (const route of [
  "src/app/api/feed/route.ts",
  "src/app/api/feed/[matchId]/route.ts",
  "src/app/api/feed/[matchId]/comments/route.ts",
  "src/app/api/feed/[matchId]/reactions/route.ts",
  "src/app/api/search/route.ts",
  "src/app/(public)/feed/[matchId]/page.tsx",
]) {
  assert.match(
    read(route),
    /status:\s*"MATCHED"/,
    `${route} must expose only completed matches`
  );
}

for (const publicDetail of [
  "src/app/api/feed/[matchId]/route.ts",
  "src/app/(public)/feed/[matchId]/page.tsx",
]) {
  const source = read(publicDetail);
  assert.doesNotMatch(
    source,
    /negotiationLog:\s*match\.negotiationLogs\.map|content:\s*log\.content/,
    `${publicDetail} must not expose private agent dialogue`
  );
}

for (const publicRoute of [
  "src/app/api/feed/route.ts",
  "src/app/api/feed/[matchId]/route.ts",
  "src/app/api/search/route.ts",
]) {
  const source = read(publicRoute);
  assert.doesNotMatch(
    source,
    /include:\s*\{\s*context:\s*true\s*\}/,
    `${publicRoute} must not read raw AgentContext for a public response`
  );
}

console.log("PASS: public feed exposes only explicitly public completed matches");
