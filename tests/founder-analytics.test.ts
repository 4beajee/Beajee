import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { requireAnalyticsAdmin, requireFounderAnalytics } from "../src/lib/admin-analytics/auth";
import {
  buildFounderHeadlineChanges,
  buildFounderWeeklyRanges,
  sanitizeFounderAnalytics,
} from "../src/lib/admin-analytics/bundle";

const ROOT = path.resolve(__dirname, "..");

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`PASS: ${label}`);
}

{
  const original = process.env.FOUNDER_ANALYTICS_SECRET;
  const originalAdmin = process.env.ANALYTICS_ADMIN_SECRET;
  delete process.env.FOUNDER_ANALYTICS_SECRET;
  const missing = requireFounderAnalytics(new NextRequest("http://localhost/api/admin/analytics/founder-weekly"));
  assert.equal(missing?.status, 503);

  process.env.FOUNDER_ANALYTICS_SECRET = "founder-only-secret";
  process.env.ANALYTICS_ADMIN_SECRET = "admin-only-secret";
  const denied = requireFounderAnalytics(new NextRequest("http://localhost/api/admin/analytics/founder-weekly", {
    headers: { authorization: "Bearer wrong-secret" },
  }));
  assert.equal(denied?.status, 401);
  const allowed = requireFounderAnalytics(new NextRequest("http://localhost/api/admin/analytics/founder-weekly", {
    headers: { authorization: "Bearer founder-only-secret" },
  }));
  assert.equal(allowed, null);
  const noAdminEscalation = requireAnalyticsAdmin(new NextRequest("http://localhost/api/admin/analytics", {
    headers: { authorization: "Bearer founder-only-secret" },
  }));
  assert.equal(noAdminEscalation?.status, 401);

  if (original === undefined) delete process.env.FOUNDER_ANALYTICS_SECRET;
  else process.env.FOUNDER_ANALYTICS_SECRET = original;
  if (originalAdmin === undefined) delete process.env.ANALYTICS_ADMIN_SECRET;
  else process.env.ANALYTICS_ADMIN_SECRET = originalAdmin;
  ok("founder endpoint uses a dedicated fail-closed Bearer credential");
}

{
  const now = new Date("2026-07-02T18:00:00.000Z");
  const ranges = buildFounderWeeklyRanges(now);
  assert.equal(ranges.current.to.toISOString(), now.toISOString());
  assert.equal(ranges.current.from?.getTime(), now.getTime() - 7 * 86_400_000);
  assert.equal((ranges.previous.to.getTime() + 1), ranges.current.from?.getTime());
  assert.equal(ranges.previous.from?.getTime(), ranges.previous.to.getTime() - 7 * 86_400_000 + 1);
  ok("weekly comparison periods are contiguous and equal in duration");
}

function fixture() {
  return {
    overview: {
      summary: { owners: { total: 12 } },
      ttfv: { firstProposed: { waitingOver48h: 1 } },
      funnel: { onboardedOwners: 8 },
      series: {
        ownersCreated: [{ value: 4 }],
        proposals: [{ value: 6 }],
        matched: [{ value: 3 }],
        adviceRequested: [{ value: 2 }],
      },
    },
    trust: {
      trustGap: { matchedRate: 0.5 },
      ghosting: { activeNegotiations: 3, ghostedOver24h: 1, ghostedRate: 0.33, oldest: [{ matchId: "private" }] },
      humanConversion: { proposedToMatchedRate: 0.5 },
      matchPrecision: { avgSimilarity: 0.8 },
      negotiationEfficiency: { agentsTracked: 4 },
    },
    network: {
      freshness: { avgDaysSinceSignificantUpdate: 2 },
      embeddingDrift: { significantPublishesInRange: 3 },
      contextVolume: { totalPublishedContexts: 8, demoContexts: 1, realContexts: 7, topLookingForPhrases: ["private need"] },
      supplyDemand: { topSupply: [{ tag: "private expertise" }] },
    },
    beacons: {
      liquidity: { createdInRange: 2 },
      falsePositives: { exactLinkedDeclines: 0 },
      topQueries: [{ query: "private query" }],
    },
    advice: {
      sessions: { total: 2 },
      conversion: { chatsWithAdvice: 2, chatsWithContactExchange: 1, adviceConversionRate: 0.5, examples: [{ signals: ["private contact"] }] },
      dissonance: { completedSessions: 2, severe: 0, mild: 1, severeRate: 0, verdicts: [{ verdict: "private text" }] },
    },
    agents: { integrity: { agentsTracked: 4 }, topSpammy: [{ ownerName: "Private Name" }] },
    countries: { summary: { registeredUsers: 4 }, countries: [{ countryCode: "US", total: 4 }] },
    users: { summary: { totalUsers: 4, onboarded: 3 }, users: [{ email: "private@example.com" }] },
    costs: {
      tracked: { totalUsd: 10 },
      untrackedActivity: { contextPublishes: 3 },
      webhooks: { successRate: 1 },
    },
    anomalies: { anomalies: [{ key: "ghosting", summary: "1 negotiation is stuck" }] },
    reports: { summary: { totalReports: 1 }, topReasons: ["private narrative"], recentReports: [{ reporter: { email: "private@example.com" } }] },
  };
}

{
  const safe = sanitizeFounderAnalytics(fixture() as never);
  const serialized = JSON.stringify(safe);
  for (const forbidden of ["private@example.com", "Private Name", "private need", "private query", "private contact", "private narrative", "private text"]) {
    assert.equal(serialized.includes(forbidden), false, `snapshot must exclude ${forbidden}`);
  }
  assert.equal(safe.overview.activity.proposals, 6);
  assert.equal(safe.reports.totalReports, 1);
  ok("founder snapshot keeps aggregates and strips user-level or free-text data");
}

{
  const current = sanitizeFounderAnalytics(fixture() as never);
  const previousFixture = fixture();
  previousFixture.overview.series.ownersCreated = [{ value: 2 }];
  previousFixture.overview.series.proposals = [{ value: 0 }];
  const previous = sanitizeFounderAnalytics(previousFixture as never);
  const changes = buildFounderHeadlineChanges(current, previous);
  assert.deepEqual(changes.newOwners, { current: 4, previous: 2, absolute: 2, percent: 100 });
  assert.deepEqual(changes.proposals, { current: 6, previous: 0, absolute: 6, percent: null });
  ok("week-over-week changes avoid misleading percentages for a zero baseline");
}

{
  const docs = fs.readFileSync(path.join(ROOT, "docs/HERMES_FOUNDER_ANALYTICS.md"), "utf8");
  assert.match(docs, /telegram:<chat_id>:<thread_id>/);
  assert.match(docs, /BEAJEE_FOUNDER_ANALYTICS_SECRET/);
  assert.match(docs, /under 600 words/);
  assert.match(docs, /facts from hypotheses/i);
  assert.match(docs, /attach_to_session=true/);
  ok("Hermes instructions pin the private credential, founder prompt, and Telegram Topic delivery");
}

console.log(`\nAll ${passed} founder analytics tests passed.`);
