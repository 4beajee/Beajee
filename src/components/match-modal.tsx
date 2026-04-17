"use client";

import { useEffect, useState, useCallback } from "react";
import { NegotiationTimeline } from "./negotiation-timeline";

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

interface MatchModalProps {
  matchId: string;
  onClose: () => void;
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

export function MatchModal({ matchId, onClose }: MatchModalProps) {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/feed/${matchId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [matchId]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-8 md:p-10 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-neutral-600 hover:text-white transition-colors"
        >
          &#10005;
        </button>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header: avatars + names */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-mono text-neutral-400">
                {getInitials(data.participants[0].displayName)}
              </div>
              <span className="text-sm text-neutral-500">
                {data.participants[0].displayName} &harr;{" "}
                {data.participants[1].displayName}
              </span>
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-mono text-neutral-400">
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
            <div className="flex items-center justify-center gap-3 mb-10">
              <StatusBadge status={data.status} />
              <span className="text-xs text-neutral-600">
                {new Date(data.createdAt).toLocaleDateString("en", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="border-t border-[#1a1a1a] pt-8">
              <NegotiationTimeline logs={data.negotiationLog} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
