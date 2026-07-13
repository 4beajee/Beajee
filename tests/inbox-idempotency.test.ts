import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "prisma/migrations/20260713130000_inbox_event_deduplication/migration.sql"),
  "utf8"
);
const inbox = fs.readFileSync(path.join(root, "src/lib/services/inbox.ts"), "utf8");
const negotiation = fs.readFileSync(path.join(root, "src/lib/services/negotiation.ts"), "utf8");

assert.match(schema, /dedupeKey\s+String\?\s+@unique/);
assert.match(migration, /CREATE UNIQUE INDEX "inbox_events_dedupe_key_key"/);
assert.match(inbox, /db\.inboxEvent\.upsert/);
assert.match(negotiation, /match:\$\{matchId\}:proposed:/);
assert.match(negotiation, /match:\$\{matchId\}:confirmed:/);

console.log("PASS: match delivery events have durable idempotency keys");
