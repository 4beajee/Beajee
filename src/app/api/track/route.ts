import { NextRequest, NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/services/telegram";

interface VisitorInfo {
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

interface TrackPayload extends VisitorInfo {
  event: string;
  // Login/signup specific
  loginMethod?: "google" | "credentials";
  email?: string;
  userName?: string;
  // Cookie consent specific
  cookieDecision?: "accepted" | "declined";
}

const ALLOWED_EVENTS = ["page_visit", "cookie_accept", "cookie_decline", "login", "signup"];

const EVENT_TITLES: Record<string, string> = {
  page_visit: "New Visitor",
  cookie_accept: "Cookie Accepted",
  cookie_decline: "Cookie Declined",
  login: "User Login",
  signup: "New Signup",
};

function extractIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function extractGeo(request: NextRequest) {
  return {
    country: request.headers.get("x-vercel-ip-country") ?? "",
    region: request.headers.get("x-vercel-ip-country-region") ?? "",
    city: request.headers.get("x-vercel-ip-city") ?? "",
  };
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

function formatDeviceBlock(payload: VisitorInfo): string[] {
  const { browser, os, isMobile } = parseUserAgent(payload.userAgent);
  const device = isMobile ? "Mobile" : "Desktop";

  const lines = [
    `<b>Device</b>`,
    `Type: ${device}`,
    `OS: ${os}`,
    `Browser: ${browser}`,
    `Screen: ${payload.screenWidth}x${payload.screenHeight}`,
    `Viewport: ${payload.viewportWidth}x${payload.viewportHeight}`,
  ];

  if (payload.touchPoints > 0) lines.push(`Touch: ${payload.touchPoints} points`);
  if (payload.hardwareConcurrency) lines.push(`CPU cores: ${payload.hardwareConcurrency}`);
  if (payload.deviceMemory) lines.push(`RAM: ~${payload.deviceMemory}GB`);
  if (payload.connectionType) lines.push(`Connection: ${payload.connectionType}`);

  return lines;
}

function formatVisitorBlock(ip: string, geo: Record<string, string>, payload: VisitorInfo): string[] {
  const lines = [
    `<b>Visitor</b>`,
    `IP: <code>${ip}</code>`,
  ];

  const location = [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
  if (location) lines.push(`Location: ${location}`);

  lines.push(
    `Language: ${payload.language} (${payload.languages.join(", ")})`,
    `Timezone: ${payload.timezone}`,
  );

  return lines;
}

function formatContextBlock(payload: VisitorInfo): string[] {
  return [
    `<b>Context</b>`,
    `Page: ${payload.pageUrl}`,
    `Referrer: ${payload.referrer || "Direct"}`,
    `Cookies enabled: ${payload.cookieEnabled ? "Yes" : "No"}`,
    `Online: ${payload.online ? "Yes" : "No"}`,
  ];
}

function buildMessage(payload: TrackPayload, ip: string, geo: Record<string, string>): string {
  const title = EVENT_TITLES[payload.event] ?? payload.event;
  const lines: string[] = [`<b>${title}</b>`, ""];

  // Event-specific info
  if (payload.event === "login" || payload.event === "signup") {
    if (payload.email) lines.push(`Email: <code>${payload.email}</code>`);
    if (payload.userName) lines.push(`Name: ${payload.userName}`);
    if (payload.loginMethod) {
      lines.push(`Method: ${payload.loginMethod === "google" ? "Google" : "Email + Password"}`);
    }
    lines.push("");
  }

  if (payload.event === "cookie_decline") {
    lines.push(`Decision: Declined all cookies`, "");
  }

  // Common blocks
  lines.push(...formatVisitorBlock(ip, geo, payload), "");
  lines.push(...formatDeviceBlock(payload), "");
  lines.push(...formatContextBlock(payload));

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrackPayload = await request.json();

    if (!ALLOWED_EVENTS.includes(payload.event)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }

    const ip = extractIp(request);
    const geo = extractGeo(request);
    const message = buildMessage(payload, ip, geo);
    const result = await sendTelegramNotification(message);

    return NextResponse.json({ ok: result.sent });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
