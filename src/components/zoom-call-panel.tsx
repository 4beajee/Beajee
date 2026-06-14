"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  SoftSurface,
  cx,
  getMattePillClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/app-chrome";

interface CallProposal {
  proposalId: string;
  start: string;
  end: string;
  label: string;
  proposedByMe?: boolean;
}

interface CallStatus {
  matchId: string;
  status: string;
  wantsCallByMe: boolean;
  wantsCallByOther: boolean;
  bothWantCall: boolean;
  zoomUrl: string | null;
  zoomPassword?: string | null;
  scheduledAt: string | null;
  proposals: CallProposal[];
}

interface ZoomCallPanelProps {
  matchId: string;
  variant?: "compact" | "full" | "inline";
  enabled?: boolean;
  className?: string;
}

function VideoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CalendarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function ZoomCallPanel({
  matchId,
  variant = "full",
  enabled = true,
  className,
}: ZoomCallPanelProps) {
  const t = useTranslations("zoomCall");
  const [call, setCall] = useState<CallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [foundSlots, setFoundSlots] = useState<Array<{ start: string; end: string }>>([]);

  const fetchStatus = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`/api/matches/${matchId}/call`);
      if (!res.ok) {
        setCall(null);
        return;
      }
      const data = await res.json();
      setCall(data);
      setError(null);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [enabled, matchId, t]);

  useEffect(() => {
    fetchStatus();
    if (!enabled) return;
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, [enabled, fetchStatus]);

  const runAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      setActing(true);
      setError(null);
      try {
        const res = await fetch(`/api/matches/${matchId}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error ?? t("actionError"));
          return;
        }
        if (action === "find_slots" && Array.isArray(data.overlappingSlots)) {
          setFoundSlots(data.overlappingSlots);
        }
        if (action === "propose_time") {
          setFoundSlots([]);
        }
        await fetchStatus();
        return data;
      } catch {
        setError(t("actionError"));
      } finally {
        setActing(false);
      }
    },
    [fetchStatus, matchId, t]
  );

  const copyLink = useCallback(async () => {
    if (!call?.zoomUrl) return;
    try {
      await navigator.clipboard.writeText(call.zoomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("copyError"));
    }
  }, [call?.zoomUrl, t]);

  if (!enabled) return null;
  if (loading) {
    return (
      <div className={cx("rounded-[1.25rem] bg-white/[0.02] px-4 py-3 text-xs text-neutral-500", className)}>
        {t("loading")}
      </div>
    );
  }

  const pendingFromOther = call?.proposals.filter((p) => !p.proposedByMe) ?? [];
  const isCompact = variant === "compact";
  const isInline = variant === "inline";

  return (
    <div
      className={cx(
        isInline
          ? "rounded-[1.25rem] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]"
          : "rounded-[1.5rem] bg-neutral-950/50 ring-1 ring-inset ring-white/[0.08]",
        className
      )}
    >
      <div className={cx("flex items-start justify-between gap-3", isCompact ? "px-4 py-3" : "px-5 py-4")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <VideoIcon className="text-sky-300" />
            <p className="text-sm font-medium text-white">{t("title")}</p>
            {call?.bothWantCall && (
              <span className={getMattePillClass("success", "text-[10px] px-2 py-0.5")}>
                {t("bothReady")}
              </span>
            )}
          </div>
          {!isCompact && (
            <p className="mt-1 text-xs text-neutral-500">{t("subtitle")}</p>
          )}
        </div>
        {call?.zoomUrl && (
          <a
            href={call.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(primaryButtonClass, "shrink-0 text-xs")}
          >
            {t("joinCall")}
          </a>
        )}
      </div>

      <div className={cx("space-y-3", isCompact ? "px-4 pb-3" : "px-5 pb-5")}>
        {error && (
          <div className="rounded-xl bg-red-950/20 px-3 py-2 text-xs text-red-200 ring-1 ring-inset ring-red-500/20">
            {error}
          </div>
        )}

        {call?.scheduledAt && (
          <SoftSurface className="flex items-center gap-2 px-3 py-2.5 text-xs text-neutral-300">
            <CalendarIcon className="text-neutral-500" />
            <span>
              {t("scheduledFor", {
                time: new Date(call.scheduledAt).toLocaleString(),
              })}
            </span>
          </SoftSurface>
        )}

        {call?.zoomUrl ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-400">{t("linkReady")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded-lg bg-black/30 px-3 py-2 text-[11px] text-neutral-300">
                {call.zoomUrl}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className={secondaryButtonClass}
              >
                {copied ? t("copied") : t("copyLink")}
              </button>
            </div>
            {call.zoomPassword && (
              <p className="text-[11px] text-neutral-500">
                {t("password", { password: call.zoomPassword })}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!call?.wantsCallByMe && (
              <button
                type="button"
                disabled={acting}
                onClick={() => runAction("request_call")}
                className={primaryButtonClass}
              >
                {t("wantCall")}
              </button>
            )}
            {call?.wantsCallByMe && !call.wantsCallByOther && (
              <span className="text-xs text-neutral-400 italic py-2">
                {t("waitingOther")}
              </span>
            )}
            <button
              type="button"
              disabled={acting}
              onClick={() => runAction("find_slots")}
              className={secondaryButtonClass}
            >
              {t("findSlots")}
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => runAction("generate_link")}
              className={secondaryButtonClass}
            >
              {t("generateLink")}
            </button>
          </div>
        )}

        {foundSlots.length > 0 && (
          <div className="space-y-2 border-t border-white/[0.05] pt-3">
            <p className="text-xs font-medium text-neutral-300">{t("proposeSlots")}</p>
            {foundSlots.map((slot) => (
              <div
                key={slot.start}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5"
              >
                <span className="text-xs text-neutral-300">
                  {new Date(slot.start).toLocaleString()} – {new Date(slot.end).toLocaleTimeString()}
                </span>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => runAction("propose_time", { slots: [slot] })}
                  className={secondaryButtonClass}
                >
                  {t("propose")}
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingFromOther.length > 0 && (
          <div className="space-y-2 border-t border-white/[0.05] pt-3">
            <p className="text-xs font-medium text-neutral-300">{t("confirmTime")}</p>
            {pendingFromOther.map((proposal) => (
              <div
                key={proposal.proposalId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5"
              >
                <span className="text-xs text-neutral-300">{proposal.label}</span>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() =>
                    runAction("confirm_time", { proposalId: proposal.proposalId })
                  }
                  className={primaryButtonClass}
                >
                  {t("confirm")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}