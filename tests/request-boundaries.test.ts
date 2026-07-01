import assert from "node:assert/strict";
import { readLimitedJson, RequestBodyTooLargeError } from "../src/lib/request-body";
import { PersonalConnectorUpsertSchema } from "../src/types/personal-connectors";

async function main() {
  const parsed = await readLimitedJson(
    new Request("https://example.test", { method: "POST", body: JSON.stringify({ ok: true }) }),
    128
  );
  assert.deepEqual(parsed, { ok: true });

  await assert.rejects(
    readLimitedJson(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ value: "x".repeat(256) }) }),
      64
    ),
    RequestBodyTooLargeError
  );

  assert.throws(() => PersonalConnectorUpsertSchema.parse({
    type: "CALENDAR",
    config: { events: Array.from({ length: 101 }, () => ({ summary: "Busy" })) },
  }));
  assert.throws(() => PersonalConnectorUpsertSchema.parse({
    type: "CALENDAR",
    config: { unexpected: "field" },
  }));

  console.log("PASS: request streams and connector configs enforce bounded inputs");
}

void main();
