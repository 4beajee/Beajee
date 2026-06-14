/**
 * Zoom call scheduling tests — run with:
 *   node --import tsx tests/match-call.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { __test as calendarTest } from "../src/lib/services/calendar-slots";
import { generateZoomMeeting } from "../src/lib/services/match-call";

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
  const first = generateZoomMeeting("match_test_1");
  const second = generateZoomMeeting("match_test_1");
  assert.equal(first.zoomUrl, second.zoomUrl);
  assert.match(first.zoomUrl, /^https:\/\/zoom\.us\/j\/\d+/);
  ok("generateZoomMeeting is deterministic per match");
}

{
  const mcpRoute = fs.readFileSync(path.join(ROOT, "src/app/api/mcp/route.ts"), "utf8");
  assert.match(mcpRoute, /requestZoomCallTool/);
  assert.match(mcpRoute, /findCallSlotsTool/);
  assert.match(mcpRoute, /proposeCallTimeTool/);
  assert.match(mcpRoute, /confirmCallTimeTool/);
  assert.match(mcpRoute, /getCallStatusTool/);
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