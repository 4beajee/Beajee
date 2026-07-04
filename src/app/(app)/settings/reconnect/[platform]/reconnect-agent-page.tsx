"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AgentPlatformLogo } from "@/components/agent-platform-logo";
import {
  PageHeader,
  codePanelClass,
  cx,
  pageFrameClass,
  primaryButtonClass,
  subtleButtonClass,
} from "@/components/ui/app-chrome";
import {
  getAgentPlatformLabel,
  type AgentPlatformValue,
} from "@/lib/agent-platform";
import type { ReconnectionGuide } from "@/lib/onboarding/reconnection-guide";

interface SetupResponse {
  prompt: string;
  agent_id: string;
  platform: AgentPlatformValue;
  platformLabel: string;
  fileName: string;
  reconnectionGuide: ReconnectionGuide;
}

export function ReconnectAgentPage({
  requestedPlatform,
  previousPlatform,
}: {
  requestedPlatform: AgentPlatformValue;
  previousPlatform: AgentPlatformValue | null;
}) {
  const t = useTranslations("reconnect");
  const [data, setData] = useState<SetupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/agent-setup-prompt", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? t("loadError"));
        return body as SetupResponse;
      })
      .then((body) => {
        if (cancelled) return;
        if (body.platform !== requestedPlatform) {
          throw new Error(t("platformMismatch"));
        }
        setData(body);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t("loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedPlatform, t]);

  const copyPrompt = async () => {
    if (!data?.prompt) return;
    await navigator.clipboard.writeText(data.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className={cx(pageFrameClass, "grid min-h-[60vh] place-items-center")}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={pageFrameClass}>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="rounded-xl bg-red-500/[0.08] p-5 text-sm text-red-200 ring-1 ring-inset ring-red-400/20">
          {error ?? t("loadError")}
        </div>
        <Link href="/settings" className={cx(subtleButtonClass, "mt-5")}>{t("backToSettings")}</Link>
      </div>
    );
  }

  const guide = data.reconnectionGuide;
  const oldLabel = previousPlatform ? getAgentPlatformLabel(previousPlatform) : t("previousAgent");

  return (
    <div className={pageFrameClass}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-8 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5 ring-1 ring-inset ring-white/[0.10] sm:p-6">
        <div className="flex items-center justify-center gap-4 sm:gap-7">
          <PlatformCard platform={previousPlatform} label={oldLabel} eyebrow={t("from")} muted />
          <div className="flex flex-col items-center gap-2 text-neutral-500">
            <span className="h-px w-8 bg-white/15 sm:w-14" />
            <span aria-hidden="true" className="text-xl">→</span>
          </div>
          <PlatformCard platform={data.platform} label={data.platformLabel} eyebrow={t("to")} />
        </div>
        <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-6 text-neutral-400">
          {t("preserved")}
        </p>
      </div>

      <div className="space-y-4">
        <Step number={1} title={t("step1Title")}>
          <p>{t("step1Body", { oldPlatform: oldLabel })}</p>
        </Step>

        <Step number={2} title={t("step2Title", { platform: data.platformLabel })}>
          <p>{guide.pasteTarget}</p>
          <div className={cx(codePanelClass, "mt-4 max-h-[320px] overflow-y-auto p-4 font-mono text-xs leading-5 text-neutral-300 whitespace-pre-wrap select-all")}>
            {data.prompt}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copyPrompt} className={primaryButtonClass}>
              {copied ? t("copied") : t("copyPrompt")}
            </button>
            <span className="text-xs text-neutral-500">{t("expires")}</span>
          </div>
        </Step>

        <Step number={3} title={t("step3Title")}>
          <p>{t("instructionFile", { fileName: data.fileName })}</p>
          <ul className="mt-3 space-y-2">
            {guide.setupNotes.map((note) => <CheckItem key={note}>{note}</CheckItem>)}
          </ul>
          {guide.documentationUrl && (
            <a href={guide.documentationUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
              {t("officialDocs", { platform: data.platformLabel })}
            </a>
          )}
        </Step>

        <Step number={4} title={t("step4Title")}>
          <ul className="space-y-2">
            {guide.verificationSteps.map((step) => <CheckItem key={step}>{step}</CheckItem>)}
          </ul>
          <div className="mt-4 rounded-xl bg-sky-500/[0.07] px-4 py-3 text-sm leading-6 text-sky-100/80 ring-1 ring-inset ring-sky-400/15">
            {guide.deliveryNote}
          </div>
        </Step>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/home" className={primaryButtonClass}>{t("done")}</Link>
        <Link href="/settings" className={subtleButtonClass}>{t("backToSettings")}</Link>
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  label,
  eyebrow,
  muted = false,
}: {
  platform: AgentPlatformValue | null;
  label: string;
  eyebrow: string;
  muted?: boolean;
}) {
  return (
    <div className={cx("flex min-w-0 flex-1 flex-col items-center gap-3 rounded-xl p-4 text-center ring-1 ring-inset sm:flex-row sm:text-left", muted ? "bg-black/20 text-neutral-500 ring-white/[0.06]" : "bg-white/[0.06] text-white ring-white/[0.12]")}>
      {platform ? <AgentPlatformLogo platform={platform} /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs">?</span>}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">{eyebrow}</p>
        <p className="mt-1 truncate text-sm font-medium">{label}</p>
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.025] p-5 ring-1 ring-inset ring-white/[0.08] sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-black">{number}</span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="pl-0 text-sm leading-6 text-neutral-400 sm:pl-11">{children}</div>
    </section>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6 text-neutral-300">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
      <span>{children}</span>
    </li>
  );
}
