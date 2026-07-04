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
      setAwaitingVerification(true);
      // Same-tab navigation is reliable on mobile Safari and Chrome. Opening a
      // new window after an async request is commonly blocked as a popup.
      window.location.assign(data.url);
    } catch (cause) {
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
      viewBox="0 0 240.1 240.1"
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id="telegram-logo-gradient"
          gradientUnits="userSpaceOnUse"
          x1="-838.041"
          y1="660.581"
          x2="-838.041"
          y2="660.3427"
          gradientTransform="matrix(1000 0 0 -1000 838161 660581)"
        >
          <stop offset="0" stopColor="#2AABEE" />
          <stop offset="1" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      <circle
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#telegram-logo-gradient)"
        cx="120.1"
        cy="120.1"
        r="120.1"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FFFFFF"
        d="M54.3,118.8c35-15.2,58.3-25.3,70-30.2 c33.3-13.9,40.3-16.3,44.8-16.4c1,0,3.2,0.2,4.7,1.4c1.2,1,1.5,2.3,1.7,3.3s0.4,3.1,0.2,4.7c-1.8,19-9.6,65.1-13.6,86.3 c-1.7,9-5,12-8.2,12.3c-7,0.6-12.3-4.6-19-9c-10.6-6.9-16.5-11.2-26.8-18c-11.9-7.8-4.2-12.1,2.6-19.1c1.8-1.8,32.5-29.8,33.1-32.3 c0.1-0.3,0.1-1.5-0.6-2.1c-0.7-0.6-1.7-0.4-2.5-0.2c-1.1,0.2-17.9,11.4-50.6,33.5c-4.8,3.3-9.1,4.9-13,4.8 c-4.3-0.1-12.5-2.4-18.7-4.4c-7.5-2.4-13.5-3.7-13-7.9C45.7,123.3,48.7,121.1,54.3,118.8z"
      />
    </svg>
  );
}
