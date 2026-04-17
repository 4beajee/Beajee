"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Step = "platform" | "goal" | "consent" | "sensitive" | "research" | "complete";
type Platform = "open_claw" | "nemo_claw" | "zero_claw" | "nano_claw";
type Goal = "partnership" | "collaboration" | "mentor" | "peer";

const PLATFORM_FILE_NAMES: Record<Platform, string> = {
  open_claw: "SOUL.md",
  nemo_claw: "SOUL.md",
  zero_claw: "SOUL.md",
  nano_claw: "SOUL.md",
};

export default function OnboardingPage() {
  const { data: session } = useSession();
  const t = useTranslations();
  const [step, setStep] = useState<Step>("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [researchConsent, setResearchConsent] = useState(false);
  const [result, setResult] = useState<{
    owner: { id: string };
    agent: { agentId: string; apiKey: string };
    fileName: string;
    soulMdEndpoint: string;
    setupPrompt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const PLATFORMS: { value: Platform; label: string; description: string }[] = [
    {
      value: "open_claw",
      label: t("onboarding.openClaw"),
      description: t("onboarding.openClawDesc"),
    },
    {
      value: "nemo_claw",
      label: t("onboarding.nemoClaw"),
      description: t("onboarding.nemoClawDesc"),
    },
    {
      value: "zero_claw",
      label: t("onboarding.zeroClaw"),
      description: t("onboarding.zeroClawDesc"),
    },
    {
      value: "nano_claw",
      label: t("onboarding.nanoClaw"),
      description: t("onboarding.nanoClawDesc"),
    },
  ];

  const GOALS: { value: Goal; label: string; description: string }[] = [
    {
      value: "partnership",
      label: t("goals.partnership"),
      description: t("goals.partnershipDesc"),
    },
    {
      value: "collaboration",
      label: t("goals.collaboration"),
      description: t("goals.collaborationDesc"),
    },
    {
      value: "mentor",
      label: t("goals.mentor"),
      description: t("goals.mentorDesc"),
    },
    {
      value: "peer",
      label: t("goals.peer"),
      description: t("goals.peerDesc"),
    },
  ];

  const SENSITIVE_CATEGORIES = [
    t("sensitiveTopics.health"),
    t("sensitiveTopics.finances"),
    t("sensitiveTopics.relationships"),
    t("sensitiveTopics.psychological"),
  ];

  const fileName = selectedPlatform
    ? PLATFORM_FILE_NAMES[selectedPlatform]
    : "SOUL.md";

  const handlePlatformSelect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setStep("goal");
  };

  const handleGoalSelect = (goal: Goal) => {
    setSelectedGoal(goal);
    setStep("consent");
  };

  const handleConsentYes = () => {
    setStep("sensitive");
  };

  const handleConsentNo = () => {
    setError(
      t("onboarding.consentError")
    );
  };

  const toggleExcluded = (topic: string) => {
    setExcludedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  const handleComplete = async () => {
    if (!selectedGoal || !selectedPlatform) return;
    setLoading(true);
    setError(null);

    try {
      const body = {
        agentPlatform: selectedPlatform,
        networkingGoal: selectedGoal,
        privacyConsent: true,
        researchConsent,
        excludedTopics,
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server error — please refresh and try again");
      }
      if (!res.ok) throw new Error(data.error);

      // Refresh JWT so middleware sees onboarded=true.
      try {
        await fetch("/api/auth/session");
      } catch {
        // Non-critical
      }

      setResult(data);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // silently fail
    }
  };

  const handleDownloadFile = async () => {
    if (!result) return;
    try {
      const res = await fetch(result.soulMdEndpoint);
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to download ${fileName}`);
    }
  };

  const TOTAL_STEPS = 5;
  const stepNumber =
    step === "platform" ? 1
      : step === "goal" ? 2
      : step === "consent" ? 3
      : step === "sensitive" ? 4
      : step === "research" ? 5
      : 6;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="text-3xl font-bold tracking-tight text-white hover:text-neutral-300 transition-colors"
          >
            {t("common.gennety")}
          </Link>
          <p className="mt-2 text-sm text-neutral-500">
            {t("onboarding.tagline")}
          </p>
          {session?.user?.email && (
            <p className="mt-1 text-xs text-neutral-600">
              {t("onboarding.signedInAs", { email: session.user.email })}
            </p>
          )}
        </div>

        {/* Progress */}
        {step !== "complete" && (
          <div className="flex items-center gap-2 justify-center mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-1 w-8 rounded-full transition-colors ${
                  s <= stepNumber ? "bg-white" : "bg-neutral-800"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step 1: Platform Selection */}
        {step === "platform" && (
          <div>
            <h2 className="text-lg font-medium text-neutral-200 mb-6 text-center">
              {t("onboarding.platformTitle")}
            </h2>
            <div className="space-y-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePlatformSelect(p.value)}
                  className="w-full text-left p-4 rounded-lg border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 transition-all group"
                >
                  <span className="text-white font-medium group-hover:text-white">
                    {p.label}
                  </span>
                  <span className="block mt-1 text-sm text-neutral-500">
                    {p.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Goal Selection */}
        {step === "goal" && (
          <div>
            <h2 className="text-lg font-medium text-neutral-200 mb-6 text-center">
              {t("onboarding.goalTitle")}
            </h2>
            <div className="space-y-3">
              {GOALS.map((goal) => (
                <button
                  key={goal.value}
                  onClick={() => handleGoalSelect(goal.value)}
                  className="w-full text-left p-4 rounded-lg border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 transition-all group"
                >
                  <span className="text-white font-medium group-hover:text-white">
                    {goal.label}
                  </span>
                  <span className="block mt-1 text-sm text-neutral-500">
                    {goal.description}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep("platform")}
              className="mt-4 w-full text-xs text-neutral-600 hover:text-neutral-400"
            >
              {t("common.back")}
            </button>
          </div>
        )}

        {/* Step 3: Consent */}
        {step === "consent" && (
          <div>
            <h2 className="text-lg font-medium text-neutral-200 mb-4 text-center">
              {t("onboarding.consentTitle")}
            </h2>
            <div className="p-5 rounded-lg border border-neutral-800 mb-6">
              <p className="text-sm text-neutral-300 leading-relaxed">
                {t("onboarding.consentQuestion")}
              </p>
              <p className="text-xs text-neutral-500 mt-3">
                {t("onboarding.consentDesc")}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConsentYes}
                className="flex-1 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors"
              >
                {t("onboarding.yesConsent")}
              </button>
              <button
                onClick={handleConsentNo}
                className="flex-1 py-3 rounded-lg border border-neutral-700 text-neutral-400 font-medium text-sm hover:border-neutral-500 transition-colors"
              >
                {t("onboarding.noConsent")}
              </button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={() => {
                setStep("goal");
                setError(null);
              }}
              className="mt-4 w-full text-xs text-neutral-600 hover:text-neutral-400"
            >
              {t("common.back")}
            </button>
          </div>
        )}

        {/* Step 4: Sensitive Topics */}
        {step === "sensitive" && (
          <div>
            <h2 className="text-lg font-medium text-neutral-200 mb-2 text-center">
              {t("onboarding.sensitiveTitle")}
            </h2>
            <p className="text-sm text-neutral-500 mb-6 text-center"
              dangerouslySetInnerHTML={{ __html: t("onboarding.sensitiveDesc") }}
            />

            <div className="space-y-2 mb-8">
              {SENSITIVE_CATEGORIES.map((topic) => {
                const excluded = excludedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleExcluded(topic)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-sm ${
                      excluded
                        ? "border-red-900/50 bg-red-950/30 text-red-300"
                        : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
                    }`}
                  >
                    <span>{topic}</span>
                    <span
                      className={`text-xs font-medium ${
                        excluded ? "text-red-400" : "text-neutral-600"
                      }`}
                    >
                      {excluded ? t("status.excluded") : t("status.shared")}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep("research")}
              className="w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors"
            >
              {t("common.continue")}
            </button>

            <button
              onClick={() => setStep("consent")}
              className="mt-4 w-full text-xs text-neutral-600 hover:text-neutral-400"
            >
              {t("common.back")}
            </button>
          </div>
        )}

        {/* Step 5: Research Consent (Purpose B — optional) */}
        {step === "research" && (
          <div>
            <h2 className="text-lg font-medium text-neutral-200 mb-2 text-center">
              {t("onboarding.researchTitle")}
            </h2>
            <p className="text-sm text-neutral-500 mb-6 text-center">
              {t("onboarding.researchOptional")}
            </p>

            <div className="p-5 rounded-lg border border-neutral-800 mb-6">
              <p className="text-sm text-neutral-300 leading-relaxed">
                {t("onboarding.researchQuestion")}
              </p>
              <p className="text-xs text-neutral-500 mt-3">
                {t("onboarding.researchDesc")}
              </p>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setResearchConsent(true)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  researchConsent
                    ? "border-white bg-white text-black"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                {t("onboarding.yesConsent")}
              </button>
              <button
                onClick={() => setResearchConsent(false)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  !researchConsent
                    ? "border-white bg-white text-black"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                {t("onboarding.noThanks")}
              </button>
            </div>

            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {loading ? t("onboarding.settingUp") : t("onboarding.createAgent")}
            </button>

            {error && (
              <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={() => setStep("sensitive")}
              className="mt-4 w-full text-xs text-neutral-600 hover:text-neutral-400"
            >
              {t("common.back")}
            </button>
          </div>
        )}

        {/* Complete — Copy setup prompt */}
        {step === "complete" && result && (
          <div>
            <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-green-950/50 border border-green-800/50 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-lg font-medium text-white">
                {t("onboarding.agentReady")}
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                {t("onboarding.copyPromptDesc")}
              </p>
            </div>

            {/* Setup prompt */}
            <div className="relative mb-4">
              <div className="p-4 rounded-lg border border-neutral-700 bg-neutral-900 font-mono text-xs text-neutral-300 leading-relaxed break-all select-all">
                {result.setupPrompt}
              </div>
              <button
                onClick={() => handleCopy(result.setupPrompt, "prompt")}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                {copied === "prompt" ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            <button
              onClick={() => handleCopy(result.setupPrompt, "prompt")}
              className="w-full py-3.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors mb-6"
            >
              {copied === "prompt" ? t("common.copied") : t("onboarding.copySetupPrompt")}
            </button>

            {/* How it works */}
            <div className="space-y-3 mb-6">
              {[
                {
                  num: "1",
                  title: t("onboarding.step1Title"),
                  desc: t("onboarding.step1Desc"),
                },
                {
                  num: "2",
                  title: t("onboarding.step2Title", { fileName }),
                  desc: t("onboarding.step2Desc"),
                },
                {
                  num: "3",
                  title: t("onboarding.step3Title"),
                  desc: t("onboarding.step3Desc"),
                },
              ].map((item) => (
                <div
                  key={item.num}
                  className="flex gap-4 p-3 rounded-lg border border-neutral-800/50 text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-semibold text-neutral-400">{item.num}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-300">{item.title}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Manual setup fallback */}
            <div className="border-t border-neutral-800 pt-4">
              <button
                onClick={() => setShowManual(!showManual)}
                className="w-full flex items-center justify-between text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                <span>{t("onboarding.preferManual")}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showManual ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showManual && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleDownloadFile}
                    className="w-full py-2.5 rounded-lg border border-neutral-800 text-neutral-400 text-xs font-medium hover:border-neutral-600 hover:text-neutral-300 transition-colors"
                  >
                    {t("onboarding.downloadFile", { fileName })}
                  </button>
                  <div className="p-3 rounded-lg bg-neutral-900/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-600">{t("onboarding.agentId")}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-neutral-400 font-mono truncate">{result.agent.agentId}</span>
                        <button
                          onClick={() => handleCopy(result.agent.agentId, "agentId")}
                          className="text-neutral-700 hover:text-neutral-400 transition-colors shrink-0"
                        >
                          {copied === "agentId" ? (
                            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-600">{t("onboarding.apiKey")}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-neutral-400 font-mono truncate">{result.agent.apiKey}</span>
                        <button
                          onClick={() => handleCopy(result.agent.apiKey, "apiKey")}
                          className="text-neutral-700 hover:text-neutral-400 transition-colors shrink-0"
                        >
                          {copied === "apiKey" ? (
                            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
            )}

            {/* Go to dashboard */}
            <div className="mt-6 text-center">
              <Link
                href="/home"
                className="inline-block py-2.5 px-6 rounded-lg border border-neutral-700 text-neutral-300 font-medium text-sm hover:border-neutral-500 hover:text-white transition-colors"
              >
                {t("onboarding.goToDashboard")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
