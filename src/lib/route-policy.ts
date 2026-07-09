export const LANDING_EXACT = ["/cookie-policy", "/privacy", "/terms"] as const;
export const PUBLIC_FILE_EXACT = [
  "/skill.md",
  "/llms.txt",
  "/INDEX.md",
  "/AGENTS.md",
  "/icon.png",
  "/apple-icon.png",
  "/match-share-night.png",
  "/match-preview-maya.png",
  "/match-preview-noah.png",
] as const;
export const PUBLIC_FILE_PREFIXES = [
  "/skills",
  "/tools",
  "/.well-known",
  "/agent-platforms",
  "/sounds",
] as const;
export const APP_ASSET_PREFIXES = ["/agent-platforms", "/sounds"] as const;
export const APP_PREFIXES = [
  "/home",
  "/matches",
  "/profile",
  "/u",
  "/activity",
  "/notify",
  "/chat",
  "/onboarding",
  "/settings",
] as const;
export const APP_EXACT = ["/login", "/forgot-password", "/reset-password", "/telegram"] as const;
export const PUBLIC_PAGE_PREFIXES = ["/feed"] as const;
export const PUBLIC_API_EXACT = [
  "/api/mcp",
  "/api/stats",
  "/api/locale",
  "/api/consent",
  "/api/search",
] as const;
export const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/feed",
  "/api/setup",
  "/api/soul",
  "/api/oauth",
  "/api/admin/analytics",
  "/api/agent",
  "/api/cron",
  "/api/telegram",
] as const;

export function matchesSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function matchesAnySegment(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => matchesSegment(pathname, prefix));
}

export function isPublicApiPath(pathname: string) {
  return PUBLIC_API_EXACT.includes(pathname as (typeof PUBLIC_API_EXACT)[number]) ||
    matchesAnySegment(pathname, PUBLIC_API_PREFIXES);
}
