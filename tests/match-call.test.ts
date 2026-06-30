/**
 * Zoom call scheduling tests — run with:
 *   node --import tsx tests/match-call.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { __test as calendarTest } from "../src/lib/services/calendar-slots";
import { validateCallSlots } from "../src/lib/services/match-call";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

{
  const merged = calendarTest.mergeRanges([
    { start: new Date("2026-06-16T10:00:00Z"), end: new Date("2026-06-16T11:00:00Z") },
    { start: new Date("2026-06-16T10:30:00Z"), end: new Date("2026-06-16T12:00:00Z") },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].end.toISOString(), "2026-06-16T12:00:00.000Z");
  ok("mergeRanges combines overlapping busy blocks");
}

{
  const slotsA = calendarTest.splitIntoSlots(
    [{ start: new Date("2026-06-16T09:00:00Z"), end: new Date("2026-06-16T12:00:00Z") }],
    30 * 60 * 1000,
    10
  );
  const slotsB = calendarTest.splitIntoSlots(
    [{ start: new Date("2026-06-16T10:00:00Z"), end: new Date("2026-06-16T13:00:00Z") }],
    30 * 60 * 1000,
    10
  );
  const overlap = calendarTest.intersectSlots(slotsA, slotsB);
  assert.ok(overlap.length >= 3);
  ok("intersectSlots finds mutual free windows");
}

{
  const now = new Date("2026-06-16T09:00:00Z");
  const slots = validateCallSlots([
    { start: "2026-06-17T10:00:00Z", end: "2026-06-17T10:30:00Z" },
    { start: "2026-06-17T11:00:00Z", end: "2026-06-17T11:30:00Z" },
  ], now);
  assert.equal(slots.length, 2);
  assert.throws(() => validateCallSlots([
    { start: "2026-06-17T10:00:00Z", end: "2026-06-17T10:05:00Z" },
  ], now), /15 and 120 minutes/);
  assert.throws(() => validateCallSlots([
    { start: "2026-06-17T11:00:00Z", end: "2026-06-17T11:30:00Z" },
    { start: "2026-06-17T10:00:00Z", end: "2026-06-17T10:30:00Z" },
  ], now), /ordered/);
  ok("call slot validation rejects malformed, short, and unordered proposals");
}

{
  const matchCall = fs.readFileSync(path.join(ROOT, "src/lib/services/match-call.ts"), "utf8");
  const provider = fs.readFileSync(path.join(ROOT, "src/lib/zoom-provider.ts"), "utf8");
  assert.doesNotMatch(matchCall, /createHash|https:\/\/zoom\.us\/j\/\$\{/);
  assert.match(matchCall, /createZoomMeeting/);
  assert.match(provider, /body\.join_url/);
  assert.match(provider, /Zoom meeting creation returned an incomplete resource/);
  ok("Zoom links come only from a confirmed provider resource");
}

{
  const mcpRoute = fs.readFileSync(path.join(ROOT, "src/app/api/mcp/route.ts"), "utf8");
  assert.match(mcpRoute, /requestZoomCallTool/);
  assert.match(mcpRoute, /findCallSlotsTool/);
  assert.match(mcpRoute, /proposeCallTimeTool/);
  assert.match(mcpRoute, /confirmCallTimeTool/);
  assert.match(mcpRoute, /getCallStatusTool/);
  for (const tool of [
    "request-zoom-call.ts",
    "find-call-slots.ts",
    "propose-call-time.ts",
    "confirm-call-time.ts",
    "get-call-status.ts",
  ]) {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/mcp/tools", tool), "utf8");
    assert.match(source, /requireMcpActor\(actor\)/);
    assert.doesNotMatch(source, /\n\s+agent_id:\s*\{/);
  }
  ok("MCP route registers all zoom call tools");
}

{
  const skill = fs.readFileSync(path.join(ROOT, "skill-zoom-call.md"), "utf8");
  assert.match(skill, /request_zoom_call/);
  assert.match(skill, /find_call_slots/);
  assert.match(skill, /propose_call_time/);
  assert.match(skill, /confirm_call_time/);
  ok("skill-zoom-call.md documents the full agent workflow");
}

{
  const negotiation = fs.readFileSync(path.join(ROOT, "src/lib/services/negotiation.ts"), "utf8");
  assert.match(negotiation, /buildSchedulingDeliveryPayload/);
  ok("match proposal includes scheduling delivery payloads");
}

console.log(`\nAll ${passed} match-call tests passed.`);
