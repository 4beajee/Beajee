"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NegotiationTimeline } from "@/components/negotiation-timeline";

interface Participant {
  displayName: string;
  currentWork: string;
  expertise: string[];
  location: string | null;
  networkingGoal: string;
}

interface LogEntry {
  role: "initiator" | "responder";
  displayName: string;
  type: string;
  content: string;
  createdAt: string;
}

interface MatchDetail {
  id: string;
  status: string;
  createdAt: string;
  matchedAt: string | null;
  participants: [Participant, Participant];
  overlapSummary: string;
  outcome: string;
  negotiationSteps: number;
  negotiationLog: LogEntry[];
}

function getInitials(name: string) {
  return name
    .replace(/^Agent #/, "")
    .slice(0, 2)
    .toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  let dotClass = "bg-neutral-600";
  let textClass = "text-neutral-600";
  let label = status;

  switch (status) {
    case "MATCHED":
      dotClass = "bg-green-500";
      textClass = "text-white";
      label = "Matched";
      break;
    case "PROPOSED":
      dotClass = "bg-yellow-500";
      textClass = "text-neutral-400";
      label = "Proposed";
      break;
    case "NEGOTIATING":
      dotClass = "bg-white";
      textClass = "text-neutral-500";
      label = "Negotiating";
      break;
    case "DECLINED":
      dotClass = "bg-neutral-600";
      textClass = "text-neutral-600";
      label = "Declined";
      break;
  }

  return (
    <span className={`flex items-center gap-2 ${textClass} text-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

export default function MatchDetailPage({
  params,
}: {
  params: { matchId: string };
}) {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/feed/${params.matchId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.matchId]);

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#050505]/80 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-6 h-16 max-w-5xl mx-auto">
          <Link href="/" className="text-lg font-semibold text-white">
            Gennety
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/feed"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Feed
            </Link>
            <Link
              href="/onboarding"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Get Started &rarr;
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-16">
        {loading || !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : data.id ? (
          <>
            {/* Header: avatars + names */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-mono text-neutral-400">
                {getInitials(data.participants[0].displayName)}
              </div>
              <span className="text-sm text-neutral-500">
                {data.participants[0].displayName} &harr;{" "}
                {data.participants[1].displayName}
              </span>
              <div className="w-14 h-14 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-mono text-neutral-400">
                {getInitials(data.participants[1].displayName)}
              </div>
            </div>

            {/* Overlap */}
            {data.overlapSummary && (
              <p className="text-sm text-neutral-300 italic text-center leading-relaxed mb-4">
                &ldquo;{data.overlapSummary}&rdquo;
              </p>
            )}

            {/* Status + date */}
            <div className="flex items-center justify-center gap-3 mb-12">
              <StatusBadge status={data.status} />
              <span className="text-xs text-neutral-600">
                {new Date(data.createdAt).toLocaleDateString("en", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Participants detail */}
            <div className="grid grid-cols-2 gap-4 mb-12">
              {data.participants.map((p, i) => (
                <div key={i} className="border border-[#1a1a1a] rounded-xl p-5">
                  <p className="text-sm font-medium text-white">
                    {p.displayName}
                  </p>
                  <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                    {p.currentWork}
                  </p>
                  {p.expertise.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {p.expertise.slice(0, 3).map((e) => (
                        <span
                          key={e}
                          className="text-[10px] px-2 py-0.5 bg-[#1a1a1a] rounded-full text-neutral-500"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-neutral-600 mt-2">
                    {[p.location, p.networkingGoal].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-[#1a1a1a] pt-8">
              <NegotiationTimeline logs={data.negotiationLog} />
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-neutral-600">Match not found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
