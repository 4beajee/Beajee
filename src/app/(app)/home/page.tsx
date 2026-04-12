"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Stats {
  totalMembers: number;
  totalMatches: number;
  matchesThisWeek: number;
  activeNegotiations: number;
  topExpertise: { tag: string; count: number }[];
  recentMatches: {
    id: string;
    overlapSummary: string;
    matchedAt: string | null;
    personA: { displayName: string; currentWork: string; networkingGoal: string };
    personB: { displayName: string; currentWork: string; networkingGoal: string };
  }[];
}

interface MyData {
  matchCount: number;
  pendingCount: number;
  freshnessState: string | null;
  agentActive: boolean;
}

export default function HomePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [myData, setMyData] = useState<MyData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations();

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/matches").then((r) => r.json()),
    ])
      .then(([statsData, matchesData]) => {
        setStats(statsData);

        const matches = matchesData.matches ?? matchesData ?? [];
        const matched = Array.isArray(matches)
          ? matches.filter((m: { status: string }) => m.status === "MATCHED").length
          : 0;
        const pending = Array.isArray(matches)
          ? matches.filter(
              (m: { status: string; confirmedByMe: boolean }) =>
                m.status === "PROPOSED" && !m.confirmedByMe
            ).length
          : 0;

        setMyData({
          matchCount: matched,
          pendingCount: pending,
          freshnessState: matchesData.freshnessState ?? null,
          agentActive:
            !matchesData.freshnessState ||
            matchesData.freshnessState === "ACTIVE" ||
            matchesData.freshnessState === "AGING",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionStatus]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const userName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-10">
      {/* Greeting */}
      <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
        {t("home.welcomeBack", { name: userName })}
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        {t("home.networkStatus")}
      </p>

      {/* Agent Status Card */}
      <div className="border border-neutral-800 rounded-xl p-5 mb-6 bg-neutral-900/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-neutral-300">{t("home.yourAgent")}</h2>
          <AgentStatusBadge
            active={myData?.agentActive ?? false}
            state={myData?.freshnessState}
          />
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-0 mb-4 overflow-x-auto no-scrollbar">
          <ProgressStep
            step={1}
            label={t("home.profileCreated")}
            done={true}
          />
          <ProgressConnector done={myData ? myData.matchCount > 0 || myData.pendingCount > 0 : false} />
          <ProgressStep
            step={2}
            label={t("home.agentSearching")}
            done={myData ? myData.matchCount > 0 || myData.pendingCount > 0 : false}
            active={myData ? myData.matchCount === 0 && myData.pendingCount === 0 : true}
          />
          <ProgressConnector done={(myData?.matchCount ?? 0) > 0} />
          <ProgressStep
            step={3}
            label={t("home.firstMatch")}
            done={(myData?.matchCount ?? 0) > 0}
            active={(myData?.pendingCount ?? 0) > 0 && (myData?.matchCount ?? 0) === 0}
          />
        </div>

        {/* Quick Stats for User */}
        <div className="flex gap-4 pt-3 border-t border-neutral-800">
          <Link
            href="/matches"
            className="flex-1 text-center p-3 rounded-lg hover:bg-neutral-800/50 transition-colors"
          >
            <span className="block text-xl font-semibold text-white">
              {myData?.matchCount ?? 0}
            </span>
            <span className="text-xs text-neutral-500">{t("home.activeMatches")}</span>
          </Link>
          <Link
            href="/notify"
            className="flex-1 text-center p-3 rounded-lg hover:bg-neutral-800/50 transition-colors"
          >
            <span className="block text-xl font-semibold text-white">
              {myData?.pendingCount ?? 0}
            </span>
            <span className="text-xs text-neutral-500">{t("home.pendingProposals")}</span>
          </Link>
        </div>
      </div>

      {/* Network Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          value={stats?.totalMembers ?? 0}
          label={t("home.membersInNetwork")}
        />
        <StatCard
          value={stats?.totalMatches ?? 0}
          label={t("home.matchesMade")}
        />
        <StatCard
          value={stats?.matchesThisWeek ?? 0}
          label={t("home.matchesThisWeek")}
        />
        <StatCard
          value={stats?.activeNegotiations ?? 0}
          label={t("home.negotiationsNow")}
          pulse={true}
        />
      </div>

      {/* Top Expertise Tags */}
      {stats && stats.topExpertise.length > 0 && (
        <div className="border border-neutral-800 rounded-xl p-5 mb-6 bg-neutral-900/50">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">
            {t("home.popularExpertise")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.topExpertise.map(({ tag, count }) => (
              <span
                key={tag}
                className="text-xs px-3 py-1.5 bg-neutral-800 rounded-full text-neutral-400 border border-neutral-700/50"
              >
                {tag}
                <span className="ml-1.5 text-neutral-600">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Matches Feed — Social Proof */}
      <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-neutral-300">
            {t("home.recentMatches")}
          </h2>
          <Link
            href="/activity"
            className="text-xs text-neutral-500 hover:text-white transition-colors"
          >
            {t("common.viewAll")} &rarr;
          </Link>
        </div>

        {stats && stats.recentMatches.length > 0 ? (
          <div className="space-y-3">
            {stats.recentMatches.map((match) => (
              <RecentMatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-600 py-4 text-center">
            {t("home.matchesWillAppear")}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function AgentStatusBadge({
  active,
  state,
}: {
  active: boolean;
  state: string | null | undefined;
}) {
  const t = useTranslations();

  if (!active) {
    const message =
      state === "STALE"
        ? t("home.pausedUpdateContext")
        : state === "INACTIVE"
        ? t("home.sleeping")
        : t("freshness.inactive");
    return (
      <span className="flex items-center gap-2 text-xs text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        {message}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs text-green-400">
      <span className="relative w-1.5 h-1.5 rounded-full bg-green-400">
        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
      </span>
      {t("home.activeSearching")}
    </span>
  );
}

function ProgressStep({
  step,
  label,
  done,
  active,
}: {
  step: number;
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mb-1.5 ${
          done
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : active
            ? "bg-white/10 text-white border border-white/20"
            : "bg-neutral-800 text-neutral-600 border border-neutral-700"
        }`}
      >
        {done ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          step
        )}
      </div>
      <span
        className={`text-[10px] sm:text-[11px] text-center leading-tight max-w-[60px] sm:max-w-none ${
          done ? "text-green-400/70" : active ? "text-neutral-300" : "text-neutral-600"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function ProgressConnector({ done }: { done: boolean }) {
  return (
    <div
      className={`flex-1 h-px mt-[-14px] ${
        done ? "bg-green-500/30" : "bg-neutral-800"
      }`}
    />
  );
}

function StatCard({
  value,
  label,
  pulse,
}: {
  value: number;
  label: string;
  pulse?: boolean;
}) {
  return (
    <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-900/50">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold text-white">{value}</span>
        {pulse && value > 0 && (
          <span className="relative w-1.5 h-1.5 rounded-full bg-white mt-1">
            <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
          </span>
        )}
      </div>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function RecentMatchCard({
  match,
}: {
  match: Stats["recentMatches"][number];
}) {
  const timeAgo = match.matchedAt ? getTimeAgo(match.matchedAt) : "";

  return (
    <div className="p-3.5 rounded-lg bg-neutral-800/30 border border-neutral-800/50">
      {/* Who matched */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-neutral-700/50 flex items-center justify-center text-[10px] font-mono text-neutral-400 flex-shrink-0">
          {match.personA.displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-[10px] text-neutral-600">&harr;</span>
        <div className="w-6 h-6 rounded-full bg-neutral-700/50 flex items-center justify-center text-[10px] font-mono text-neutral-400 flex-shrink-0">
          {match.personB.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-neutral-300">
            {match.personA.displayName}
          </span>
          <span className="text-xs text-neutral-600"> &amp; </span>
          <span className="text-xs text-neutral-300">
            {match.personB.displayName}
          </span>
        </div>
        {timeAgo && (
          <span className="text-[10px] text-neutral-600 flex-shrink-0">
            {timeAgo}
          </span>
        )}
      </div>

      {/* Why they matched */}
      <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2 italic">
        &ldquo;{match.overlapSummary}&rdquo;
      </p>
    </div>
  );
}

function getTimeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
