"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { locales, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function switchLocale(next: Locale) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    setOpen(false);
    router.refresh();
  }

  const flag: Record<Locale, string> = { en: "EN", zh: "中", hi: "हि" };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full transition-colors text-neutral-400 hover:text-white ${
          compact ? "px-2 py-1.5 text-xs" : "px-2.5 py-2 text-sm"
        }`}
      >
        <GlobeIcon />
        <span className="font-medium">{flag[locale]}</span>
        <ChevronIcon open={open} />
      </button>

      <div
        className={`absolute top-full mt-1.5 right-0 z-50 min-w-[160px] rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-2xl shadow-black/40 overflow-hidden transition-all duration-200 origin-top-right ${
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="py-1">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between transition-colors ${
                l === locale
                  ? "text-white"
                  : "text-neutral-500 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span>{localeNames[l]}</span>
              {l === locale && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
