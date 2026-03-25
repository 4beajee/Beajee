"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const STORAGE_KEY = "gennety_cookie_consent";

type ConsentState = "pending" | "accepted" | "declined";

function getConsent(): ConsentState {
  if (typeof window === "undefined") return "pending";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "accepted" || stored === "declined") return stored;
  return "pending";
}

function collectVisitorInfo() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string };
  };

  return {
    language: nav.language,
    languages: [...nav.languages],
    userAgent: nav.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    referrer: document.referrer,
    pageUrl: window.location.href,
    platform: nav.platform ?? "",
    colorDepth: screen.colorDepth,
    cookieEnabled: nav.cookieEnabled,
    online: nav.onLine,
    touchPoints: nav.maxTouchPoints ?? 0,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    connectionType: nav.connection?.effectiveType,
  };
}

function sendTrackEvent(event: string) {
  const info = collectVisitorInfo();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...info }),
  }).catch(() => {});
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (getConsent() === "pending") {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback((accepted: boolean) => {
    setHiding(true);
    localStorage.setItem(STORAGE_KEY, accepted ? "accepted" : "declined");

    if (accepted) {
      sendTrackEvent("cookie_accept");
    }

    setTimeout(() => setVisible(false), 300);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className={`fixed bottom-0 left-0 right-0 z-[100] p-4 transition-all duration-300 ${
        hiding ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="max-w-2xl mx-auto rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-xl p-5 shadow-[0_-4px_40px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <p className="text-sm text-neutral-400 leading-relaxed flex-1">
            We use essential cookies to make Gennety work.{" "}
            <Link
              href="/cookie-policy"
              className="text-white underline underline-offset-2 hover:text-neutral-300 transition-colors"
            >
              Cookie Policy
            </Link>
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => dismiss(false)}
              className="px-4 py-2 text-sm text-neutral-500 hover:text-white border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg transition-colors"
              aria-label="Decline cookies"
            >
              Decline
            </button>
            <button
              onClick={() => dismiss(true)}
              className="px-5 py-2 text-sm font-medium text-black bg-white hover:bg-neutral-200 rounded-lg transition-colors"
              aria-label="Accept cookies"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
