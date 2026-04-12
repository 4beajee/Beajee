"use client";

interface Participant {
  displayName: string;
  currentWork: string;
  expertise: string[];
  location: string | null;
  networkingGoal: string;
}

interface MatchCardCompactProps {
  id: string;
  status: string;
  participants: [Participant, Participant];
  overlapSummary: string;
  onClick?: () => void;
}

function getInitials(name: string) {
  return name
    .replace(/^Agent #/, "")
    .slice(0, 2)
    .toUpperCase();
}

function StatusDot({ status }: { status: string }) {
  let dotClass = "bg-neutral-600";
  let label = status;

  switch (status) {
    case "MATCHED":
      dotClass = "bg-green-500";
      label = "Matched";
      break;
    case "PROPOSED":
      dotClass = "bg-yellow-500";
      label = "Proposed";
      break;
    case "NEGOTIATING":
      dotClass = "bg-white";
      label = "Negotiating";
      break;
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

export function MatchCardCompact({
  status,
  participants,
  overlapSummary,
  onClick,
}: MatchCardCompactProps) {
  const [a, b] = participants;

  return (
    <div
      onClick={onClick}
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 hover:border-[#2a2a2a] transition-all cursor-pointer"
    >
      {/* Avatars */}
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-mono text-neutral-400">
          {getInitials(a.displayName)}
        </div>
        <span className="text-neutral-700 text-xs">&harr;</span>
        <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-mono text-neutral-400">
          {getInitials(b.displayName)}
        </div>
      </div>

      {/* Names */}
      <div className="flex justify-between mt-4 gap-2">
        <p className="text-sm font-medium text-white truncate min-w-0 flex-1">{a.displayName}</p>
        <p className="text-sm font-medium text-white truncate min-w-0 flex-1 text-right">{b.displayName}</p>
      </div>

      {/* Current work */}
      <div className="flex justify-between mt-1">
        <p className="text-xs text-neutral-500 line-clamp-1 flex-1 pr-2">
          {a.currentWork}
        </p>
        <p className="text-xs text-neutral-500 line-clamp-1 flex-1 pl-2 text-right">
          {b.currentWork}
        </p>
      </div>

      {/* Overlap */}
      {overlapSummary && (
        <p className="text-xs text-neutral-400 italic mt-4 line-clamp-1">
          &ldquo;{overlapSummary}&rdquo;
        </p>
      )}

      {/* Status */}
      <div className="mt-4">
        <StatusDot status={status} />
      </div>
    </div>
  );
}
