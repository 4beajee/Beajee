import assert from "node:assert/strict";
import { __test as calendar } from "../src/lib/connectors/personal/calendar";
import { isPublicIp, validateExternalHttpsUrl } from "../src/lib/safe-external-fetch";

for (const address of [
  "127.0.0.1",
  "10.0.0.5",
  "169.254.169.254",
  "172.16.0.1",
  "192.168.1.1",
  "::1",
  "fd00::1",
  "fe80::1",
  "::ffff:127.0.0.1",
]) {
  assert.equal(isPublicIp(address), false, `${address} must be blocked`);
}
assert.equal(isPublicIp("8.8.8.8"), true);
assert.throws(() => validateExternalHttpsUrl("http://calendar.example.com/a.ics"), /HTTPS/);
assert.throws(() => validateExternalHttpsUrl("https://169.254.169.254/latest/meta-data"), /non-public/);
assert.throws(() => validateExternalHttpsUrl("https://calendar.internal/a.ics"), /public host/);

const privateEvent = calendar.normalizeCalendarEvent({
  id: "private-1",
  summary: "Therapy appointment",
  description: "Private medical details",
  location: "Clinic",
  visibility: "private",
  start: "2026-07-01T10:00:00Z",
  end: "2026-07-01T11:00:00Z",
});
assert.ok(privateEvent, "private events must still block availability");
assert.equal(privateEvent.title, "Busy");
assert.equal(privateEvent.rawPayload.description, null);
assert.equal(privateEvent.rawPayload.location, null);
assert.equal(privateEvent.rawPayload.start, "2026-07-01T10:00:00Z");

assert.equal(
  calendar.normalizeCalendarEvent({
    id: "cancelled-1",
    summary: "Cancelled",
    status: "cancelled",
    start: "2026-07-01T10:00:00Z",
  }),
  null
);

console.log("PASS: calendar fetch targets are public and private events remain occupied without metadata");
