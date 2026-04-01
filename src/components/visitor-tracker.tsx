"use client";

import { useEffect } from "react";

const SESSION_KEY = "gennety_visit_tracked";

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

export function VisitorTracker() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    sessionStorage.setItem(SESSION_KEY, "1");

    const info = collectVisitorInfo();
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "page_visit", ...info }),
    }).catch(() => {});
  }, []);

  return null;
}
