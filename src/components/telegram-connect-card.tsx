"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui/app-chrome";

type TelegramConnectCardProps = {
  initialConnected: boolean;
  placement: "home" | "matches";
  className?: string;
};

const COPY = {
  home: {
    eyebrow: "Beajee in Telegram",
    title: "Your network, right in your pocket",
    description:
      "Get match proposals, messages, and short context check-ins without keeping the web app open.",
  },
  matches: {
    eyebrow: "Never miss a match",
    title: "Continue in Telegram",
    description:
      "Review new introductions, reply to messages, and arrange calls as soon as your agent finds the right person.",
  },
} as const;

export function TelegramConnectCard({
  initialConnected,
  placement,
  className,
}: TelegramConnectCardProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[placement];

  useEffect(() => setConnected(initialConnected), [initialConnected]);

  useEffect(() => {
    if (!awaitingVerification || connected) return;

    const checkConnection = () => {
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
    };

    const timer = window.setInterval(checkConnection, 3_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkConnection();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [awaitingVerification, connected]);

  const connect = async () => {
    const telegramWindow = window.open("", "_blank");
    if (telegramWindow) telegramWindow.opener = null;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start Telegram sync");
      if (data.connected) {
        telegramWindow?.close();
        setConnected(true);
        return;
      }
      if (!data.url) throw new Error("Telegram sync link is unavailable");
      if (telegramWindow) {
        telegramWindow.location.href = data.url;
      } else {
        window.location.assign(data.url);
      }
      setAwaitingVerification(true);
    } catch (cause) {
      telegramWindow?.close();
      setError(cause instanceof Error ? cause.message : "Could not start Telegram sync");
    } finally {
      setLoading(false);
    }
  };

  if (connected) return null;

  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] bg-[#229ED9] px-5 py-5 text-white shadow-[0_18px_50px_rgba(34,158,217,0.2)] sm:px-6",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/[0.10]"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.015em] text-white">
            {copy.title}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-white/80">{copy.description}</p>
          {error ? (
            <p className="mt-2 text-xs font-medium text-white" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={connect}
          disabled={loading || awaitingVerification}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#168AC0] shadow-[0_10px_30px_rgba(0,0,0,0.16)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#F7FCFF] hover:shadow-[0_14px_34px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#229ED9] active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
        >
          <TelegramLogo />
          {loading
            ? "Opening Telegram…"
            : awaitingVerification
              ? "Finish sync in Telegram…"
              : "Sync with Telegram"}
        </button>
      </div>
    </section>
  );
}

function TelegramLogo() {
  return (
    <svg
      aria-hidden="true"
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
    >
      <path
        fill="currentColor"
        d="M21.94 4.67c.3-1.42-.52-1.98-1.46-1.62L2.93 9.82c-1.2.47-1.18 1.14-.2 1.44l4.5 1.4 10.43-6.58c.5-.3.95-.14.58.2l-8.45 7.63-.32 4.57c.47 0 .67-.21.93-.46l2.16-2.1 4.5 3.33c.83.46 1.43.22 1.64-.77l3.24-13.81Z"
      />
    </svg>
  );
}
