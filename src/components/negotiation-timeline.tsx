"use client";

interface LogEntry {
  role: "initiator" | "responder";
  displayName: string;
  type: string;
  content: string;
  createdAt: string;
}

interface NegotiationTimelineProps {
  logs: LogEntry[];
}

const typeColors: Record<string, string> = {
  reasoning: "text-blue-400/60",
  proposal: "text-purple-400/60",
  evaluation: "text-yellow-400/60",
  agreement: "text-green-400/60",
  decline: "text-red-400/60",
};

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  const month = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  return `${hours}:${mins} · ${month} ${day}`;
}

export function NegotiationTimeline({ logs }: NegotiationTimelineProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-600 mb-8">
        Negotiation Timeline
      </p>

      <div className="space-y-4">
        {logs.map((log, i) => {
          const isAgreement = log.type === "agreement";
          const isDecline = log.type === "decline";
          const colorClass = typeColors[log.type] || "text-neutral-600";

          let borderClass = "border-[#1a1a1a]";
          let bgClass = "";

          if (isAgreement) {
            borderClass = "border-green-900/30";
            bgClass = "bg-green-950/10";
          } else if (isDecline) {
            borderClass = "border-red-900/30";
            bgClass = "bg-red-950/10";
          }

          return (
            <div
              key={i}
              className={`border ${borderClass} rounded-xl p-6 ${bgClass}`}
            >
              {/* Step header */}
              <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-4">
                Step {i + 1} ·{" "}
                <span className={colorClass}>{log.type}</span>
              </p>

              {/* Agent info */}
              {isAgreement ? (
                <p className="text-sm font-medium text-green-400 mb-2">
                  <span className="mr-2">&#10003;</span>Mutual agreement reached
                </p>
              ) : isDecline ? (
                <p className="text-sm font-medium text-red-400 mb-2">
                  Negotiation declined
                </p>
              ) : (
                <p className="text-sm font-medium text-white mb-2">
                  Agent {log.displayName}
                  {log.type === "proposal" && (
                    <span className="text-xs text-neutral-600 ml-2">
                      &rarr; proposal
                    </span>
                  )}
                </p>
              )}

              {/* Content */}
              <p
                className={`text-sm font-mono leading-relaxed whitespace-pre-wrap ${
                  isAgreement
                    ? "text-green-300/80"
                    : isDecline
                    ? "text-red-300/80"
                    : "text-neutral-400"
                }`}
              >
                {log.content}
              </p>

              {/* Timestamp */}
              <p className="text-[10px] text-neutral-700 text-right mt-4">
                {formatTimestamp(log.createdAt)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
