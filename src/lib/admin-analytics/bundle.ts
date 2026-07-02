import type { AnalyticsRange } from "@/lib/admin-analytics/range";
import {
  getAdviceAnalytics,
  getAgentAnalytics,
  getAnomalyAnalytics,
  getBeaconAnalytics,
  getCostAnalytics,
  getCountryAnalytics,
  getNetworkAnalytics,
  getOverviewAnalytics,
  getReportAnalytics,
  getTrustAnalytics,
  getUsersAnalytics,
} from "@/lib/admin-analytics/service";

export async function loadAdminAnalyticsBundle(range: AnalyticsRange) {
  const [overview, trust, network, beacons, advice, agents, countries, users, costs, anomalies, reports] =
    await Promise.all([
      getOverviewAnalytics(range),
      getTrustAnalytics(range),
      getNetworkAnalytics(range),
      getBeaconAnalytics(range),
      getAdviceAnalytics(range),
      getAgentAnalytics(range),
      getCountryAnalytics(range),
      getUsersAnalytics(range),
      getCostAnalytics(range),
      getAnomalyAnalytics(range),
      getReportAnalytics(range),
    ]);

  return { overview, trust, network, beacons, advice, agents, countries, users, costs, anomalies, reports };
}

export type AdminAnalyticsBundle = Awaited<ReturnType<typeof loadAdminAnalyticsBundle>>;

function weeklyRange(from: Date, to: Date, label: string): AnalyticsRange {
  return { key: "7d", label, from, to };
}

export function buildFounderWeeklyRanges(now = new Date()) {
  const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousTo = new Date(currentFrom.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
  return {
    current: weeklyRange(currentFrom, now, "Current 7 days"),
    previous: weeklyRange(previousFrom, previousTo, "Previous 7 days"),
  };
}

function sumSeries(series: Array<{ value: number }>) {
  return series.reduce((total, point) => total + point.value, 0);
}

export function sanitizeFounderAnalytics(bundle: AdminAnalyticsBundle) {
  return {
    overview: {
      summary: bundle.overview.summary,
      ttfv: bundle.overview.ttfv,
      funnel: bundle.overview.funnel,
      activity: {
        ownersCreated: sumSeries(bundle.overview.series.ownersCreated),
        proposals: sumSeries(bundle.overview.series.proposals),
        matched: sumSeries(bundle.overview.series.matched),
        adviceRequested: sumSeries(bundle.overview.series.adviceRequested),
      },
    },
    trust: {
      trustGap: bundle.trust.trustGap,
      ghosting: {
        activeNegotiations: bundle.trust.ghosting.activeNegotiations,
        ghostedOver24h: bundle.trust.ghosting.ghostedOver24h,
        ghostedRate: bundle.trust.ghosting.ghostedRate,
      },
      humanConversion: bundle.trust.humanConversion,
      matchPrecision: bundle.trust.matchPrecision,
      negotiationEfficiency: bundle.trust.negotiationEfficiency,
    },
    network: {
      freshness: bundle.network.freshness,
      embeddingDrift: bundle.network.embeddingDrift,
      contextVolume: {
        totalPublishedContexts: bundle.network.contextVolume.totalPublishedContexts,
        demoContexts: bundle.network.contextVolume.demoContexts,
        realContexts: bundle.network.contextVolume.realContexts,
      },
    },
    beacons: {
      liquidity: bundle.beacons.liquidity,
      falsePositives: bundle.beacons.falsePositives,
    },
    advice: {
      sessions: bundle.advice.sessions,
      conversion: {
        chatsWithAdvice: bundle.advice.conversion.chatsWithAdvice,
        chatsWithContactExchange: bundle.advice.conversion.chatsWithContactExchange,
        adviceConversionRate: bundle.advice.conversion.adviceConversionRate,
      },
      dissonance: {
        completedSessions: bundle.advice.dissonance.completedSessions,
        severe: bundle.advice.dissonance.severe,
        mild: bundle.advice.dissonance.mild,
        severeRate: bundle.advice.dissonance.severeRate,
      },
    },
    agents: bundle.agents.integrity,
    countries: bundle.countries,
    costs: {
      tracked: bundle.costs.tracked,
      untrackedActivity: bundle.costs.untrackedActivity,
      webhooks: bundle.costs.webhooks,
    },
    anomalies: bundle.anomalies.anomalies,
    reports: bundle.reports.summary,
    users: bundle.users.summary,
  };
}

type FounderAnalytics = ReturnType<typeof sanitizeFounderAnalytics>;

function change(current: number | null, previous: number | null) {
  const absolute = current === null || previous === null ? null : current - previous;
  const percent = absolute === null || previous === null || previous === 0
    ? null
    : Number(((absolute / previous) * 100).toFixed(1));
  return { current, previous, absolute, percent };
}

export function buildFounderHeadlineChanges(current: FounderAnalytics, previous: FounderAnalytics) {
  return {
    newOwners: change(current.overview.activity.ownersCreated, previous.overview.activity.ownersCreated),
    proposals: change(current.overview.activity.proposals, previous.overview.activity.proposals),
    matched: change(current.overview.activity.matched, previous.overview.activity.matched),
    proposalToMatchRate: change(
      current.trust.humanConversion.proposedToMatchedRate,
      previous.trust.humanConversion.proposedToMatchedRate
    ),
    ghostedNegotiations: change(current.trust.ghosting.ghostedOver24h, previous.trust.ghosting.ghostedOver24h),
    adviceRequests: change(current.advice.sessions.total, previous.advice.sessions.total),
    trackedCostUsd: change(current.costs.tracked.totalUsd, previous.costs.tracked.totalUsd),
    reports: change(current.reports.totalReports, previous.reports.totalReports),
  };
}

export async function buildFounderWeeklySnapshot(
  now = new Date(),
  loadBundle: typeof loadAdminAnalyticsBundle = loadAdminAnalyticsBundle
) {
  const ranges = buildFounderWeeklyRanges(now);
  // Production uses a deliberately small Prisma pool. Each bundle already fans
  // out internally, so running both periods together can exhaust the pool.
  const currentBundle = await loadBundle(ranges.current);
  const previousBundle = await loadBundle(ranges.previous);
  const current = sanitizeFounderAnalytics(currentBundle);
  const previous = sanitizeFounderAnalytics(previousBundle);

  return {
    generatedAt: now.toISOString(),
    purpose: "Private read-only founder analytics for Hermes Agent",
    privacy: "Aggregates only; excludes emails, owner names, raw messages, negotiation logs, report narratives, and context text.",
    periods: {
      current: { from: ranges.current.from?.toISOString() ?? null, to: ranges.current.to.toISOString() },
      previous: { from: ranges.previous.from?.toISOString() ?? null, to: ranges.previous.to.toISOString() },
    },
    changes: buildFounderHeadlineChanges(current, previous),
    current,
    previous,
  };
}
