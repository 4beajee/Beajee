"use client";

import { useEffect, useState } from "react";
import type { ContextQuestionDeliveryMode } from "@/lib/agent-platform";

export function ContextCheckInDelivery({
  mode,
  className = "",
}: {
  mode: ContextQuestionDeliveryMode;
  className?: string;
}) {
  const [connected, setConnected] = useState(mode === "telegram");
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setConnected(mode === "telegram"), [mode]);

  useEffect(() => {
    if (!awaitingVerification || connected) return;
    const timer = window.setInterval(() => {
      fetch("/api/telegram/link")
        .then((response) => response.json())
        .then((data) => {
          if (data.connected) {
            setConnected(true);
            setAwaitingVerification(false);
            setError(null);
          }
        })
        .catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [awaitingVerification, connected]);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start Telegram sync");
      if (data.connected) {
        setConnected(true);
        return;
      }
      if (!data.url) throw new Error("Telegram sync link is unavailable");
      window.open(data.url, "_blank", "noopener,noreferrer");
      setAwaitingVerification(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start Telegram sync");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/link");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not verify Telegram sync");
      setConnected(!!data.connected);
      if (!data.connected) setError("Telegram is not connected yet. Finish the sync in the bot.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify Telegram sync");
    } finally {
      setLoading(false);
    }
  };

  const effectiveMode = connected ? "telegram" : mode;
  return (
    <section className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Context check-ins</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-400">
            {effectiveMode === "telegram"
              ? "Active in Telegram. Beajee will send one short batch of questions at a time."
              : effectiveMode === "native_agent"
                ? "Active through your personal agent. Linking Telegram will move future check-ins there."
                : "Connect Telegram to enable short weekly check-ins. Nothing will be sent into Codex or Claude Code."}
          </p>
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>

        {effectiveMode === "telegram" ? (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/15">
            Telegram connected
          </span>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={connect}
              disabled={loading || awaitingVerification}
              className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? "Opening…" : awaitingVerification ? "Waiting for Telegram…" : "Sync Telegram with Web App"}
            </button>
            <button
              type="button"
              onClick={verify}
              disabled={loading}
              className="rounded-xl px-3 py-2 text-xs font-medium text-neutral-400 ring-1 ring-inset ring-white/[0.09] transition hover:text-white disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
