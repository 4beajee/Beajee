"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // No token at all — invalid access
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
        <div className="w-full max-w-sm text-center">
          <div className="mb-10">
            <Link
              href="/"
              className="text-3xl font-bold tracking-tight text-white hover:text-neutral-300 transition-colors"
            >
              {t("common.beajee")}
            </Link>
          </div>
          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 mb-6">
            <p className="text-sm text-neutral-300">
              This reset link is invalid. Please request a new password reset.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="inline-block py-3 px-6 rounded-lg bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors"
          >
            Request new reset link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!password) {
      setError("Enter a new password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password.length > 128) {
      setError("Password is too long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(
          data.error ?? "Something went wrong. Please try again."
        );
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
        <div className="w-full max-w-sm text-center">
          <div className="mb-10">
            <Link
              href="/"
              className="text-3xl font-bold tracking-tight text-white hover:text-neutral-300 transition-colors"
            >
              Beajee
            </Link>
          </div>
          <div className="p-4 rounded-lg bg-neutral-900 border border-emerald-800/50 mb-6">
            <p className="text-sm text-emerald-400 font-medium mb-1">
              Password updated
            </p>
            <p className="text-sm text-neutral-400">
              Your password has been changed successfully. You can now sign in
              with your new password.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="text-3xl font-bold tracking-tight text-white hover:text-neutral-300 transition-colors"
          >
            Beajee
          </Link>
          <h1 className="mt-4 text-lg font-semibold text-white">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            autoFocus
            className="w-full p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-neutral-600"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError(null);
            }}
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
            {loading ? "Saving..." : "Save new password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/login" className="text-white hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
