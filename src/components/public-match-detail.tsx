"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { getPublicMatchUrl } from "@/lib/public-url";

interface Participant {
  displayName: string;
  currentWork: string;
  expertise: string[];
  location: string | null;
  networkingGoal: string;
  image?: string;
  imagePosition?: string;
}

export interface MatchDetail {
  id: string;
  status: string;
  createdAt: string;
  matchedAt: string | null;
  participants: [Participant, Participant];
  overlapSummary: string;
  outcome: string;
  negotiationSteps: number;
  likes: number;
  dislikes: number;
  commentCount: number;
}

function getInitials(name: string) {
  return name.replace(/^Agent #/, "").slice(0, 2).toUpperCase();
}

const statusConfig: Record<
  string,
  {
    labelKey: string;
    dotClass: string;
    textClass: string;
    glowColor: string;
    ringClass: string;
    accentLine: string;
    borderAccent: string;
  }
> = {
  MATCHED: {
    labelKey: "status.matched",
    dotClass: "bg-green-500",
    textClass: "text-green-400",
    glowColor: "rgba(34, 197, 94, 0.08)",
    ringClass: "ring-green-500/20",
    accentLine: "bg-gradient-to-r from-transparent via-green-500/40 to-transparent",
    borderAccent: "border-green-500/25",
  },
  PROPOSED: {
    labelKey: "status.proposed",
    dotClass: "bg-yellow-500",
    textClass: "text-yellow-400",
    glowColor: "rgba(234, 179, 8, 0.06)",
    ringClass: "ring-yellow-500/15",
    accentLine: "bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent",
    borderAccent: "border-yellow-500/20",
  },
  NEGOTIATING: {
    labelKey: "status.negotiating",
    dotClass: "bg-white",
    textClass: "text-neutral-400",
    glowColor: "rgba(255, 255, 255, 0.04)",
    ringClass: "ring-white/10",
    accentLine: "bg-gradient-to-r from-transparent via-white/20 to-transparent",
    borderAccent: "border-white/10",
  },
  DECLINED: {
    labelKey: "status.declined",
    dotClass: "bg-neutral-600",
    textClass: "text-neutral-600",
    glowColor: "rgba(115, 115, 115, 0.04)",
    ringClass: "ring-neutral-600/10",
    accentLine: "bg-gradient-to-r from-transparent via-neutral-600/20 to-transparent",
    borderAccent: "border-neutral-700",
  },
};

function HeartIcon({ filled }: { filled?: boolean }) {
  if (filled) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ProfileOrb({ participant, tone }: { participant: Participant; tone: "warm" | "cool" }) {
  const palette = tone === "warm"
    ? "from-amber-200/30 via-orange-100/10 to-rose-200/20"
    : "from-cyan-100/20 via-sky-200/10 to-emerald-100/20";

  return (
    <div className="relative mx-auto flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-[1.75rem] border border-white/[0.14] bg-[#111113]/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {participant.image ? (
        <Image
          src={participant.image}
          alt=""
          fill
          sizes="84px"
          className="rounded-[1.7rem] object-cover"
          style={{ objectPosition: participant.imagePosition ?? "center" }}
        />
      ) : (
        <>
          <span className={`absolute inset-0 rounded-[1.7rem] bg-gradient-to-br ${palette}`} />
          <span className="absolute inset-[5px] rounded-[1.35rem] border border-white/[0.12] bg-black/10" />
          <span className="relative text-lg font-medium tracking-[-0.06em] text-white">{getInitials(participant.displayName)}</span>
        </>
      )}
      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-[#111113] bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.48)]" />
    </div>
  );
}

function MatchStory({ a, b, overlapSummary }: { a: Participant; b: Participant; overlapSummary: string }) {
  const [open, setOpen] = useState(false);
  const steps = [
    { label: "Signal", text: `${a.displayName}'s agent noticed a concrete opening in ${b.displayName}'s current work.` },
    { label: "Private evaluation", text: "Both agents checked for a complementary fit and kept personal context private." },
    { label: "Mutual yes", text: overlapSummary || "The agents agreed there was a clear reason for these two people to meet." },
  ];

  return (
    <div className="mt-8 border-t border-white/[0.12] pt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 text-left transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-200"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">How the agents found this match</span>
          <span className="mt-0.5 block text-xs text-neutral-400">A public-safe match story</span>
        </span>
        <ChevronDownIcon className={`shrink-0 text-neutral-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="pb-1 pt-5">
            <p className="mb-5 max-w-md text-xs leading-5 text-neutral-400">The full agent negotiation is private. This is the shareable version of why the introduction was made.</p>
            <ol className="space-y-5">
              {steps.map((step, index) => (
                <li key={step.label} className="relative grid grid-cols-[1.5rem_1fr] gap-3">
                  {index < steps.length - 1 && <span className="absolute left-[0.45rem] top-6 h-[calc(100%+0.55rem)] w-px bg-white/[0.16]" />}
                  <span className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-medium text-[#12241d]">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-100/80">{step.label}</span>
                    <span className="mt-1 block text-sm leading-5 text-neutral-200">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicMatchDetail({ initialData }: { initialData: MatchDetail | null }) {
  const t = useTranslations();
  const [data, setData] = useState(initialData);
  const [shareToast, setShareToast] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  const handleShare = useCallback(async () => {
    if (!data) return;

    const url = getPublicMatchUrl(data.id, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setShareToast(true);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setShareToast(false), 2000);
  }, [data]);

  const handleLike = useCallback(async () => {
    if (!data) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 350);
    try {
      const res = await fetch(`/api/feed/${data.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "LIKE" }),
      });
      if (res.ok) {
        const result = await res.json();
        setData((prev) =>
          prev ? { ...prev, likes: result.likes, dislikes: result.dislikes } : prev
        );
      }
    } catch {
      // noop
    }
  }, [data]);

  if (!data || !data.id) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Nav />
        <div className="text-center py-32">
          <p className="text-neutral-500 text-lg">{t("common.noResults")}</p>
          <Link href="/feed" className="text-sm text-neutral-600 hover:text-white transition-colors mt-4 inline-block">
            &larr; {t("common.back")}
          </Link>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[data.status] || statusConfig.NEGOTIATING;
  const [a, b] = data.participants;

  return (
    <div className="relative isolate min-h-screen bg-[#020305]/45">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'linear-gradient(rgba(1, 5, 10, 0.68), rgba(1, 5, 10, 0.84)), url("/match-share-night.png")' }}
      />
      <Nav />

      <section className="relative z-10 min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] animate-glow-breathe"
            style={{ background: cfg.glowColor }}
          />
          <div className="absolute bottom-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-amber-200/[0.035] blur-[100px] animate-glow-breathe" style={{ animationDelay: "2.5s" }} />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[150px] animate-glow-breathe"
            style={{ background: cfg.glowColor, animationDelay: "1.2s" }}
          />
        </div>

        <div className="relative w-full max-w-xl animate-card-float-in">
          <div className="overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#071015]/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_32px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
            <div className={`h-[1px] ${cfg.accentLine}`} />

            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className={`flex items-center gap-2 ${cfg.textClass} text-sm font-medium`}>
                  <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                  {t(cfg.labelKey)}
                </span>
                <span className="text-neutral-700 mx-2">&middot;</span>
                <span className="text-xs text-neutral-600">
                  {new Date(data.createdAt).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] items-start gap-2 sm:gap-4">
                <div className="min-w-0 text-center">
                  <ProfileOrb participant={a} tone="warm" />
                  <p className="mt-3 truncate text-sm font-medium text-white">{a.displayName}</p>
                  <p className="mx-auto mt-1 line-clamp-2 max-w-[150px] text-xs leading-5 text-neutral-500">{a.currentWork}</p>
                </div>
                <div className="relative flex min-w-0 items-center justify-center pt-5">
                  <span aria-hidden="true" className="absolute right-full top-[3.8rem] h-px w-11 bg-white/[0.34] sm:w-14" />
                  <span aria-hidden="true" className="absolute left-full top-[3.8rem] h-px w-11 bg-white/[0.34] sm:w-14" />
                  <div className="relative h-[4.75rem] w-[4.75rem] overflow-hidden" aria-label="Match">
                    <Image
                      src="/match-emblem.png"
                      alt=""
                      width={188}
                      height={107}
                      priority
                      className="absolute -left-[3.75rem] -top-[1.05rem] max-w-none mix-blend-screen"
                    />
                  </div>
                </div>
                <div className="min-w-0 text-center">
                  <ProfileOrb participant={b} tone="cool" />
                  <p className="mt-3 truncate text-sm font-medium text-white">{b.displayName}</p>
                  <p className="mx-auto mt-1 line-clamp-2 max-w-[150px] text-xs leading-5 text-neutral-500">{b.currentWork}</p>
                </div>
              </div>

              {data.overlapSummary && (
                <div className="mt-8 border-l border-emerald-100/[0.35] pl-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Why this match</p>
                  <p className="mt-2 text-[13px] leading-6 text-neutral-200">
                    {data.overlapSummary}
                  </p>
                </div>
              )}

              <MatchStory a={a} b={b} overlapSummary={data.overlapSummary} />

              <div className="flex items-center justify-center gap-4 mt-6 text-xs text-neutral-600">
                <span>{t("activity.steps", { count: data.negotiationSteps })}</span>
                {data.matchedAt && (
                  <>
                    <span>&middot;</span>
                    <span>matched {new Date(data.matchedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                  </>
                )}
              </div>
            </div>

            <div className="relative flex items-center justify-center gap-3 border-t border-white/[0.10] px-5 py-3 sm:gap-6 sm:px-8">
              <button
                onClick={handleLike}
                aria-label="Like this match"
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-neutral-400 transition-all hover:bg-white/[0.05] hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200 active:scale-95"
              >
                <span className={likeAnimating ? "animate-reaction-pop" : ""}>
                  <HeartIcon />
                </span>
                {data.likes > 0 && (
                  <span className={`text-sm tabular-nums ${likeAnimating ? "animate-count-bump" : ""}`}>
                    {data.likes}
                  </span>
                )}
              </button>

              <div className="w-px h-4 bg-[#1a1a1a]" />

              <span className="flex min-h-11 items-center gap-2 px-3 text-neutral-400" aria-label={`${data.commentCount} comments`}>
                <CommentIcon />
                {data.commentCount > 0 && (
                  <span className="text-sm tabular-nums">{data.commentCount}</span>
                )}
              </span>

              <div className="w-px h-4 bg-[#1a1a1a]" />

              <div className="relative">
                <button
                  onClick={handleShare}
                  aria-label="Copy public match link"
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-neutral-400 transition-all hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 active:scale-95"
                >
                  <ShareIcon />
                  <span className="text-sm">{t("common.share")}</span>
                </button>

                {shareToast && (
                  <div className="absolute bottom-[calc(100%+0.5rem)] right-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/20 animate-card-float-in whitespace-nowrap">
                    {t("common.linkCopied")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </section>

      <section className="relative z-10 max-w-2xl mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-detail-in animate-detail-in-d1">
          {data.participants.map((p, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full ring-1 ${cfg.ringClass} bg-[#111] flex items-center justify-center text-xs font-mono text-neutral-300`}>
                  {getInitials(p.displayName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{p.displayName}</p>
                  {p.location && (
                    <p className="text-[10px] text-neutral-600">{p.location}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{p.currentWork}</p>
              {p.expertise.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.expertise.slice(0, 4).map((e) => (
                    <span
                      key={e}
                      className="text-[10px] px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded-full text-neutral-500"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
              {p.networkingGoal && (
                <p className="text-[10px] text-neutral-600 mt-3">
                  {t("profile.goalsLabel")} {p.networkingGoal}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center animate-detail-in animate-detail-in-d3">
          <p className="text-neutral-600 text-sm mb-6">
            {t("activity.title")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/feed"
              className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-200 transition-all active:scale-[0.98]"
            >
              {t("nav.feed")}
            </Link>
            <Link
              href="/onboarding"
              className="px-8 py-3 border border-[#2a2a2a] text-neutral-400 rounded-full text-sm hover:text-white hover:border-[#3a3a3a] transition-all"
            >
              {t("common.getStarted")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Nav() {
  const t = useTranslations();
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#050505]/80 border-b border-[#1a1a1a]">
      <div className="flex items-center justify-between px-6 h-16 max-w-5xl mx-auto">
        <Link href="/" className="text-lg font-semibold text-white">
          {t("common.beajee")}
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/feed"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            {t("nav.feed")}
          </Link>
          <Link
            href="/onboarding"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            {t("common.getStarted")} &rarr;
          </Link>
        </div>
      </div>
    </nav>
  );
}
