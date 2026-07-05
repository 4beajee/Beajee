"use client";

import { usePathname } from "next/navigation";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { LanguageSwitcher } from "@/components/language-switcher";

// The floating language selector is only meant for public pages that have no
// settings screen of their own (login, password reset, public feed, legal).
// Inside the authenticated app and the Telegram mini app the language control
// lives in Settings instead, so we keep this FAB out of the way of their fixed
// bottom navigation.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/feed",
  "/privacy",
  "/terms",
  "/cookie-policy",
];

export function MobileLanguageFab() {
  const pathname = usePathname();
  const { isLoaded, hasConsented } = useCookieConsent();

  const onPublicPage = PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!onPublicPage) return null;
  if (!isLoaded || !hasConsented) return null;

  return (
    <div
      className="sm:hidden fixed right-3 z-[90]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="rounded-full border border-[#1a1a1a] bg-[#0a0a0a]/90 backdrop-blur-xl shadow-lg shadow-black/40">
        <LanguageSwitcher compact dropUp />
      </div>
    </div>
  );
}
