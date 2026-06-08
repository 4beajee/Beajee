"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useTranslations } from "next-intl";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

const RESEND_COOLDOWN_SECONDS = 60;

function ForgotPasswordContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmed = email.trim();
      if (!trimmed) {
        setError("Enter your email address");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError("Enter a valid email address");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });

        if (res.status === 429) {
          setError("Too many requests. Please wait a moment and try again.");
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Something went wrong. Please try again.");
          setLoading(false);
          return;
        }

        setSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="text-3xl font-bold tracking-tight text-white hover:text-neutral-300 transition-colors"
          >
            {t("common.beajee")}
          </Link>
          <h1 className="mt-4 text-lg font-semibold text-white">
            {t("auth.forgotPasswordTitle")}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {sent
              ? t("auth.resetLinkSent")
              : t("auth.forgotPasswordDesc")}
          </p>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
              <p className="text-sm text-neutral-300 leading-relaxed">
                If an account with that email exists, we sent a password reset
                link. It may take a minute to arrive — check your spam folder
                too.
              </p>
            </div>

            <button
              onClick={() => handleSubmit()}
              disabled={cooldown > 0 || loading}
              className="w-full py-3 rounded-lg border border-neutral-700 text-sm font-medium text-white hover:border-neutral-500 hover:bg-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? t("auth.sendingResetLink")
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : t("auth.sendResetLink")}
            </button>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <Link
              href="/login"
              className="block text-center text-sm text-neutral-500 hover:text-white transition-colors"
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          /* ── Request form ── */
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                autoFocus
                className="w-full p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-neutral-600"
              />

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-500">
              <Link href="/login" className="text-white hover:underline">
                {t("auth.backToLogin")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
