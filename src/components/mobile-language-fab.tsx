"use client";

import { useCookieConsent } from "@/hooks/useCookieConsent";
import { LanguageSwitcher } from "@/components/language-switcher";

export function MobileLanguageFab() {
  const { isLoaded, hasConsented } = useCookieConsent();
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
