"use client";

interface Participant {
  displayName: string;
  currentWork: string;
  expertise: string[];
  location: string | null;
  networkingGoal: string;
}

interface MatchCardProps {
  id: string;
  status: string;
  createdAt: string;
  matchedAt: string | null;
  participants: [Participant, Participant];
  overlapSummary: string;
  outcome: string;
  negotiationSteps: number;
  onClick?: () => void;
}

function getInitials(name: string) {
  return name
    .replace(/^Agent #/, "")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr: string) {
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

function StatusBadge({ status }: { status: string }) {
  let dotClass = "bg-neutral-600";
  let textClass = "text-neutral-600";
  let label = status;
  let pulse = false;

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
      pulse = true;
      break;
    case "DECLINED":
      dotClass = "bg-neutral-600";
      textClass = "text-neutral-600";
      label = "Declined";
      break;
  }

  return (
    <span className={`flex items-center gap-2 ${textClass} text-xs`}>
      <span className={`relative w-1.5 h-1.5 rounded-full ${dotClass}`}>
        {pulse && (
          <span className="absolute inset-0 rounded-full bg-white animate-ping-slow opacity-75" />
        )}
      </span>
      {label}
    </span>
  );
}

export function MatchCard({
  status,
  createdAt,
  participants,
  overlapSummary,
  negotiationSteps,
  onClick,
}: MatchCardProps) {
  const [a, b] = participants;

  return (
    <div
      onClick={onClick}
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 hover:border-[#2a2a2a] transition-all cursor-pointer"
    >
      {/* Avatars + connector */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-mono text-neutral-400 flex-shrink-0">
          {getInitials(a.displayName)}
        </div>

        <div className="flex-1 flex items-center">
          <div className="flex-1 border-t border-dashed border-[#2a2a2a]" />
          <span className="px-3 text-[10px] uppercase tracking-widest text-neutral-700 bg-[#0a0a0a]">
            negotiated
          </span>
          <div className="flex-1 border-t border-dashed border-[#2a2a2a]" />
        </div>

        <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-mono text-neutral-400 flex-shrink-0">
          {getInitials(b.displayName)}
        </div>
      </div>

      {/* Names + descriptions */}
      <div className="flex justify-between mt-5">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-base font-medium text-white">{a.displayName}</p>
          <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
            {a.currentWork}
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            {[a.location, a.networkingGoal].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex-1 min-w-0 pl-4 text-right">
          <p className="text-base font-medium text-white">{b.displayName}</p>
          <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
            {b.currentWork}
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            {[b.location, b.networkingGoal].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Overlap summary */}
      {overlapSummary && (
        <div className="border-t border-b border-[#1a1a1a] py-5 my-5">
          <p className="text-sm text-neutral-300 italic leading-relaxed">
            &ldquo;{overlapSummary}&rdquo;
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusBadge status={status} />
          <span className="text-xs text-neutral-600">
            {negotiationSteps} step{negotiationSteps !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-neutral-600">
            {timeAgo(createdAt)}
          </span>
        </div>
        <span className="text-xs text-neutral-500 hover:text-white transition-colors">
          View agent dialogue &rarr;
        </span>
      </div>
    </div>
  );
}
