"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

interface ProfileData {
  name: string | null;
  networkingGoal: string | null;
  memberSince: string;
  context: {
    ownerName: string | null;
    ownerProfession: string | null;
    ownerDomain: string | null;
    ownerExperience: string | null;
    ownerGoals: string | null;
    ownerLocation: string | null;
    currentWork: string;
    expertise: string[];
    lookingFor: string;
    notLookingFor: string | null;
    recentProblems: string | null;
    recentWins: string | null;
    location: string | null;
    networkingGoal: string;
    collaborationStyle: string | null;
    communicationStyle: string | null;
    agentSpecialization: string | null;
    agentDomains: string[];
    freshnessState: string;
    lastUpdated: string;
    lastSignificantUpdate: string;
  } | null;
  reputation: {
    score: number;
    acceptanceRate: number;
    completedMatches: number;
    totalProposed: number;
    interactionCount: number;
  };
  agent: {
    displayName: string | null;
    isActive: boolean;
    lastActiveAt: string;
  };
}

export default function ProfilePage() {
  const t = useTranslations();
  const { status: sessionStatus } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load profile");
        return r.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [sessionStatus]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-10">
        <p className="text-sm text-neutral-500">
          {error ?? "Could not load profile."}
        </p>
      </div>
    );
  }

  const ctx = profile.context;
  const rep = profile.reputation;

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            {ctx?.ownerName ?? profile.name ?? t("profile.title")}
          </h1>
          {ctx?.ownerProfession && (
            <p className="text-sm text-neutral-400 mt-1">
              {ctx.ownerProfession}
              {ctx.ownerDomain ? ` \u00b7 ${ctx.ownerDomain}` : ""}
            </p>
          )}
          {(ctx?.location ?? ctx?.ownerLocation) && (
            <p className="text-xs text-neutral-500 mt-1">
              {ctx?.location ?? ctx?.ownerLocation}
            </p>
          )}
        </div>
        <FreshnessBadge state={ctx?.freshnessState} />
      </div>

      {/* No context yet */}
      {!ctx && (
        <div className="border border-neutral-800 rounded-xl p-8 text-center bg-neutral-900/50 mb-6">
          <p className="text-sm text-neutral-400 mb-2">
            {t("profile.noContext")}
          </p>
          <p className="text-xs text-neutral-600">
            {t("profile.noContextDesc")}
          </p>
        </div>
      )}

      {ctx && (
        <>
          {/* What I'm working on */}
          <Section title={t("profile.currentWork")}>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {ctx.currentWork}
            </p>
          </Section>

          {/* Expertise */}
          {ctx.expertise.length > 0 && (
            <Section title={t("profile.expertise")}>
              <div className="flex flex-wrap gap-2">
                {ctx.expertise.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1.5 bg-neutral-800 rounded-full text-neutral-300 border border-neutral-700/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Looking for */}
          <Section title={t("profile.lookingFor")}>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {ctx.lookingFor}
            </p>
            <GoalBadge goal={ctx.networkingGoal} />
          </Section>

          {/* Not looking for */}
          {ctx.notLookingFor && (
            <Section title={t("profile.notLookingFor")}>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {ctx.notLookingFor}
              </p>
            </Section>
          )}

          {/* Current wins & problems */}
          {(ctx.recentWins || ctx.recentProblems) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {ctx.recentWins && (
                <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-900/50">
                  <h3 className="text-xs font-medium text-green-400/80 mb-2">
                    {t("profile.recentWins")}
                  </h3>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {ctx.recentWins}
                  </p>
                </div>
              )}
              {ctx.recentProblems && (
                <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-900/50">
                  <h3 className="text-xs font-medium text-amber-400/80 mb-2">
                    {t("profile.currentChallenges")}
                  </h3>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {ctx.recentProblems}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Work style */}
          {(ctx.collaborationStyle || ctx.communicationStyle) && (
            <Section title={t("profile.workStyle")}>
              {ctx.collaborationStyle && (
                <div className="mb-2">
                  <span className="text-xs text-neutral-500">
                    {t("profile.collaboration")}{" "}
                  </span>
                  <span className="text-sm text-neutral-300">
                    {ctx.collaborationStyle}
                  </span>
                </div>
              )}
              {ctx.communicationStyle && (
                <div>
                  <span className="text-xs text-neutral-500">
                    {t("profile.communication")}{" "}
                  </span>
                  <span className="text-sm text-neutral-300">
                    {ctx.communicationStyle}
                  </span>
                </div>
              )}
            </Section>
          )}

          {/* Experience & Goals */}
          {(ctx.ownerExperience || ctx.ownerGoals) && (
            <Section title={t("profile.background")}>
              {ctx.ownerExperience && (
                <div className="mb-2">
                  <span className="text-xs text-neutral-500">
                    {t("profile.experience")}{" "}
                  </span>
                  <span className="text-sm text-neutral-300">
                    {ctx.ownerExperience}
                  </span>
                </div>
              )}
              {ctx.ownerGoals && (
                <div>
                  <span className="text-xs text-neutral-500">{t("profile.goalsLabel")} </span>
                  <span className="text-sm text-neutral-300">
                    {ctx.ownerGoals}
                  </span>
                </div>
              )}
            </Section>
          )}

          {/* Agent specialization */}
          {(ctx.agentSpecialization || ctx.agentDomains.length > 0) && (
            <Section title={t("profile.agentFocus")}>
              {ctx.agentSpecialization && (
                <p className="text-sm text-neutral-300 mb-2">
                  {ctx.agentSpecialization}
                </p>
              )}
              {ctx.agentDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ctx.agentDomains.map((d) => (
                    <span
                      key={d}
                      className="text-xs px-2.5 py-1 bg-neutral-800/70 rounded-full text-neutral-400 border border-neutral-700/30"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </Section>
          )}
        </>
      )}

      {/* Reputation & Stats */}
      <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50 mb-6">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">
          {t("profile.reputation")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatBlock value={rep.score.toFixed(0)} label={t("profile.score")} />
          <StatBlock
            value={
              rep.totalProposed > 0
                ? `${(rep.acceptanceRate * 100).toFixed(0)}%`
                : "\u2014"
            }
            label={t("profile.acceptance")}
          />
          <StatBlock value={rep.completedMatches} label={t("profile.matchesLabel")} />
        </div>
      </div>

      {/* Meta footer */}
      <div className="flex items-center justify-between text-xs text-neutral-600 pt-2">
        <span>
          {t("profile.memberSince", {
            date: new Date(profile.memberSince).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
          })}
        </span>
        {ctx && (
          <span>
            {t("profile.lastUpdated", {
              time: getTimeAgo(ctx.lastUpdated),
            })}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50 mb-4">
      <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function FreshnessBadge({ state }: { state?: string }) {
  if (!state) return null;

  const config: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: "text-green-400", label: "Active" },
    AGING: { color: "text-yellow-400", label: "Aging" },
    STALE: { color: "text-amber-400", label: "Stale" },
    INACTIVE: { color: "text-neutral-500", label: "Inactive" },
  };

  const c = config[state] ?? config.INACTIVE!;

  return (
    <span className={`flex items-center gap-2 text-xs ${c.color}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${c.color.replace("text-", "bg-")}`}
      />
      {c.label}
    </span>
  );
}

function GoalBadge({ goal }: { goal: string }) {
  const labels: Record<string, string> = {
    partnership: "Looking for a partner",
    collaboration: "Open to collaborate",
    mentor: "Seeking a mentor",
    peer: "Looking for peers",
  };

  return (
    <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-white/5 text-neutral-400 border border-neutral-700/40">
      {labels[goal] ?? goal}
    </span>
  );
}

function StatBlock({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="text-center">
      <span className="block text-xl font-semibold text-white">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
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
