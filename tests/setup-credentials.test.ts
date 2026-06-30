import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildSetupPrompt } from "../src/lib/onboarding/connection-instructions";

const root = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const prompt = buildSetupPrompt(
  "agent_test",
  "setup_one_use_token",
  "https://app.beajee.com",
  "en"
);
assert.match(prompt, /Authorization: Bearer setup_one_use_token/);
assert.doesNotMatch(prompt, /\?key=/);
assert.match(prompt, /expires in 10 minutes/);

const setupRoute = read("src/app/api/setup/[agentId]/route.ts");
assert.match(setupRoute, /consumeSetupGrant\(grant, agent\.id\)/);
assert.doesNotMatch(setupRoute, /searchParams\.get\("key"\)/);
assert.match(setupRoute, /"Cache-Control": "no-store, private"/);

const soulRoute = read("src/app/api/soul/[agentId]/route.ts");
assert.match(soulRoute, /apiKey: "\$BEAJEE_API_KEY"/);
assert.doesNotMatch(soulRoute, /apiKey: agent\.apiKey/);

const wakeRoute = read("src/app/api/setup/[agentId]/wake/route.ts");
assert.doesNotMatch(wakeRoute, /searchParams\.get\("key"\)/);

const grantService = read("src/lib/setup-grants.ts");
assert.match(grantService, /used_at IS NULL/);
assert.match(grantService, /expires_at > NOW\(\)/);
assert.match(grantService, /RETURNING agent_id/);

console.log("PASS: setup credentials use expiring one-use bearer grants and never query strings");
