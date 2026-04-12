"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

interface MatchProposal {
  matchId: string;
  status: string;
  overlapSummary: string;
  framingForMe: string;
  confirmedByMe: boolean;
  otherPerson: {
    name: string | null;
    currentWork: string | null;
    expertise: string[] | null;
    location: string | null;
  };
  chatId: string | null;
}

export default function NotifyPage() {
  const t = useTranslations();
  const { status: sessionStatus } = useSession();
  const [matches, setMatches] = useState<MatchProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    fetch("/api/matches")
      .then((r) => r.json())
      .then((data) => {
        const list = data.matches ?? data ?? [];
        if (Array.isArray(list)) {
          setMatches(
            list.filter(
              (m: MatchProposal) => m.status === "PROPOSED" && !m.confirmedByMe
            )
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionStatus]);

  async function handleAction(matchId: string, action: "confirm" | "dormant") {
    setActionLoading(matchId);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, action }),
    });
    const result = await res.json();

    if (result.status === "MATCHED" && result.matchId) {
      window.location.href = `/chat/${result.matchId}`;
      return;
    }

    setMatches((prev) => prev.filter((m) => m.matchId !== matchId));
    setActionLoading(null);
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="p-12 text-center text-neutral-500 text-sm">
        {t("notify.loadingProposals")}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="px-6 pt-16 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="text-neutral-500"
          >
            <path
              d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8 14v1a2 2 0 004 0v-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="text-base font-medium text-white mb-1">
          {t("notify.noPending")}
        </h2>
        <p className="text-sm text-neutral-500 max-w-xs mx-auto mb-5">
          {t("notify.noPendingDesc")}
        </p>
        <a
          href="/activity"
          className="text-xs text-neutral-400 hover:text-white transition-colors"
        >
          {t("notify.browseNetwork")} &rarr;
        </a>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-xl sm:text-2xl font-semibold text-white mb-6 sm:mb-8">
        {t("notify.title")}
      </h1>
      {matches.map((match) => (
        <div
          key={match.matchId}
          className="border border-neutral-800 rounded-xl p-4 sm:p-6 mb-4 sm:mb-5 bg-neutral-900/50"
        >
          <div className="flex justify-between items-start gap-2 mb-4">
            <span className="text-lg sm:text-xl font-semibold text-white min-w-0 truncate">
              {match.otherPerson.name ?? "Unknown"}
            </span>
            {match.otherPerson.location && (
              <span className="text-sm text-neutral-500">
                {match.otherPerson.location}
              </span>
            )}
          </div>

          <p className="text-base leading-relaxed text-neutral-300 mb-4 p-3.5 bg-neutral-800/50 rounded-lg border-l-2 border-neutral-600">
            {match.framingForMe}
          </p>

          {match.otherPerson.currentWork && (
            <p className="text-sm text-neutral-400 mb-3">
              <strong className="text-neutral-300">Working on:</strong>{" "}
              {match.otherPerson.currentWork}
            </p>
          )}

          {match.otherPerson.expertise &&
            match.otherPerson.expertise.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {match.otherPerson.expertise.map((e) => (
                  <span
                    key={e}
                    className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-400"
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => handleAction(match.matchId, "confirm")}
              disabled={actionLoading === match.matchId}
              className="flex-1 py-3 text-sm font-semibold bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {t("notify.yesIntroduce")}
            </button>
            <button
              onClick={() => handleAction(match.matchId, "dormant")}
              disabled={actionLoading === match.matchId}
              className="flex-1 py-3 text-sm font-medium border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 transition-colors disabled:opacity-50"
            >
              {t("notify.notNow")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
