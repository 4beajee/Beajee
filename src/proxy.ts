import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  APP_EXACT,
  APP_PREFIXES,
  LANDING_EXACT,
  PUBLIC_FILE_EXACT,
  PUBLIC_FILE_PREFIXES,
  PUBLIC_PAGE_PREFIXES,
  isPublicApiPath,
  matchesAnySegment,
} from "@/lib/route-policy";

const APP_HOST = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
  : null; // e.g. "app.beajee.com"

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// Routes that belong on the landing domain only.
function isAppRoute(pathname: string) {
  return (
    APP_EXACT.includes(pathname as (typeof APP_EXACT)[number]) ||
    matchesAnySegment(pathname, APP_PREFIXES) ||
    matchesAnySegment(pathname, ["/api"])
  );
}

function isPublicFile(pathname: string) {
  return (
    PUBLIC_FILE_EXACT.includes(pathname as (typeof PUBLIC_FILE_EXACT)[number]) ||
    matchesAnySegment(pathname, PUBLIC_FILE_PREFIXES)
  );
}

function isLandingRoute(pathname: string) {
  return (
    LANDING_EXACT.includes(pathname as (typeof LANDING_EXACT)[number]) ||
    isPublicFile(pathname)
  );
}

// Determine cookie name the same way auth-options does
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
const sessionCookieName = useSecureCookies
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

function isLocalDevHost(host: string) {
  const hostname = host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isLocalDev = isLocalDevHost(host);

  // --- Subdomain routing (only in production when APP_HOST is set) ---
  if (APP_HOST && !isLocalDev && host !== APP_HOST && pathname === "/") {
    return NextResponse.redirect(new URL("/home", APP_URL));
  }

  if (APP_HOST && !isLocalDev && host !== APP_HOST && isAppRoute(pathname)) {
    // Someone hit beajee.com/login or beajee.com/matches → redirect to app subdomain
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, APP_URL));
  }

  if (APP_HOST && !isLocalDev && host === APP_HOST && pathname === "/") {
    return NextResponse.redirect(new URL("/home", APP_URL));
  }

  if (APP_HOST && LANDING_URL && !isLocalDev && host === APP_HOST && isLandingRoute(pathname)) {
    // Someone hit app.beajee.com/privacy or public agent docs → redirect to landing
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, LANDING_URL));
  }

  // --- Auth logic (unchanged, applies to both domains) ---

  // Public paths — no auth required
  const isPublic =
    LANDING_EXACT.includes(pathname as (typeof LANDING_EXACT)[number]) ||
    APP_EXACT.includes(pathname as (typeof APP_EXACT)[number]) ||
    isPublicApiPath(pathname) ||
    matchesAnySegment(pathname, PUBLIC_PAGE_PREFIXES) ||
    isPublicFile(pathname);

  if (isPublic) {
    // If already logged in and going to /login, redirect to /home
    if (pathname === "/login") {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: useSecureCookies,
        cookieName: sessionCookieName,
      });
      if (token) {
        const homeUrl = APP_URL ? new URL("/home", APP_URL) : new URL("/home", request.url);
        return NextResponse.redirect(homeUrl);
      }
    }
    return NextResponse.next();
  }

  let token;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: useSecureCookies,
      cookieName: sessionCookieName,
    });
  } catch (err) {
    console.error(`[middleware] getToken() threw for ${pathname}:`, err);
  }

  if (!token) {
    console.warn(`[middleware] Unauthorized request for ${pathname}`);

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = APP_URL
      ? new URL("/login", APP_URL)
      : new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated but not onboarded — redirect to onboarding
  if (!token.onboarded && pathname !== "/onboarding" && pathname !== "/api/onboarding") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
    }
    const onboardingUrl = APP_URL
      ? new URL("/onboarding", APP_URL)
      : new URL("/onboarding", request.url);
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|public/).*)"],
};
