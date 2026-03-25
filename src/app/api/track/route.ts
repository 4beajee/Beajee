import { NextRequest, NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/services/telegram";

interface VisitorPayload {
  event: "cookie_accept" | "onboarding_complete";
  language: string;
  languages: string[];
  userAgent: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  referrer: string;
  pageUrl: string;
  platform: string;
  colorDepth: number;
  cookieEnabled: boolean;
  online: boolean;
  touchPoints: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connectionType?: string;
}

const EVENT_LABELS: Record<string, string> = {
  cookie_accept: "Cookie Accepted",
  onboarding_complete: "Onboarding Completed",
};

function extractIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function parseUserAgent(ua: string) {
  const browser =
    ua.match(/(Chrome|Firefox|Safari|Edge|Opera|Samsung|Brave)\/[\d.]+/)?.[0] ??
    (ua.includes("CriOS") ? "Chrome iOS" : ua.includes("FxiOS") ? "Firefox iOS" : "Unknown");

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);

  return { browser, os, isMobile };
}

function formatMessage(payload: VisitorPayload, ip: string, geo: Record<string, string>): string {
  const { browser, os, isMobile } = parseUserAgent(payload.userAgent);
  const device = isMobile ? "Mobile" : "Desktop";
  const eventLabel = EVENT_LABELS[payload.event] ?? payload.event;

  const lines = [
    `<b>${eventLabel}</b>`,
    "",
    `<b>Visitor</b>`,
    `IP: <code>${ip}</code>`,
  ];

  if (geo.country) lines.push(`Location: ${[geo.city, geo.region, geo.country].filter(Boolean).join(", ")}`);

  lines.push(
    `Language: ${payload.language} (${payload.languages.join(", ")})`,
    `Timezone: ${payload.timezone}`,
    "",
    `<b>Device</b>`,
    `Type: ${device}`,
    `OS: ${os}`,
    `Browser: ${browser}`,
    `Screen: ${payload.screenWidth}x${payload.screenHeight}`,
    `Viewport: ${payload.viewportWidth}x${payload.viewportHeight}`,
    `Color depth: ${payload.colorDepth}-bit`,
    `Touch: ${payload.touchPoints > 0 ? `Yes (${payload.touchPoints} points)` : "No"}`,
  );

  if (payload.hardwareConcurrency) lines.push(`CPU cores: ${payload.hardwareConcurrency}`);
  if (payload.deviceMemory) lines.push(`RAM: ~${payload.deviceMemory}GB`);
  if (payload.connectionType) lines.push(`Connection: ${payload.connectionType}`);

  lines.push(
    "",
    `<b>Context</b>`,
    `Page: ${payload.pageUrl}`,
    `Referrer: ${payload.referrer || "Direct"}`,
    `Platform: ${payload.platform}`,
    `Cookies enabled: ${payload.cookieEnabled ? "Yes" : "No"}`,
    `Online: ${payload.online ? "Yes" : "No"}`,
  );

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const payload: VisitorPayload = await request.json();

    const allowedEvents = ["cookie_accept", "onboarding_complete"];
    if (!allowedEvents.includes(payload.event)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }

    const ip = extractIp(request);

    // Vercel geo headers (available in production)
    const geo = {
      country: request.headers.get("x-vercel-ip-country") ?? "",
      region: request.headers.get("x-vercel-ip-country-region") ?? "",
      city: request.headers.get("x-vercel-ip-city") ?? "",
    };

    const message = formatMessage(payload, ip, geo);
    const result = await sendTelegramNotification(message);

    return NextResponse.json({ ok: result.sent });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
