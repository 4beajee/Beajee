"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_SPECIALIZATIONS_BY_CATEGORY,
  COMMUNITY_SPECIALIZATION_LABELS,
  type CommunityCategory,
  type CommunitySpecialization,
  type CommunityVisibility,
} from "@/types/community";
import {
  PageHeader,
  SectionTitle,
  Surface,
  compactInputClass,
  compactSelectClass,
  compactTabActiveClass,
  compactTabBaseClass,
  compactTabIdleClass,
  compactTextareaClass,
  cx,
  errorNoticeClass,
  fieldLabelClass,
  pageFrameClass,
  primaryButtonClass,
  subtleButtonClass,
} from "@/components/ui/app-chrome";

const CATEGORIES = Object.keys(COMMUNITY_CATEGORY_LABELS) as CommunityCategory[];

export default function NewCommunityPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "agent">("manual");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CommunityVisibility>("PUBLIC");
  const [category, setCategory] = useState<CommunityCategory>("TECHNOLOGY");
  const [specialization, setSpecialization] = useState<CommunitySpecialization>("AI_DEVELOPMENT");
  const [profileVisible, setProfileVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);
  const [agentPromptLoading, setAgentPromptLoading] = useState(false);
  const [agentPromptError, setAgentPromptError] = useState<string | null>(null);
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);

  const specializations = COMMUNITY_SPECIALIZATIONS_BY_CATEGORY[category];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          visibility,
          profileVisibility: profileVisible ? "VISIBLE" : "HIDDEN",
          category: visibility === "PUBLIC" ? category : category || null,
          specialization: visibility === "PUBLIC" ? specialization : specialization || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create community");

      router.push(`/communities/${data.community.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create community");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadAgentPrompt() {
    setAgentPromptLoading(true);
    setAgentPromptError(null);
    setAgentPromptCopied(false);

    try {
      const res = await fetch("/api/communities/agent-create/prompt");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate OpenClaw prompt");
      setAgentPrompt(data.prompt);
      return data.prompt as string;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to generate OpenClaw prompt";
      setAgentPromptError(message);
      throw e;
    } finally {
      setAgentPromptLoading(false);
    }
  }

  async function copyAgentPrompt() {
    try {
      const prompt = agentPrompt ?? (await loadAgentPrompt());
      await navigator.clipboard.writeText(prompt);
      setAgentPromptCopied(true);
      setTimeout(() => setAgentPromptCopied(false), 2000);
    } catch {
      setAgentPromptError("Failed to copy prompt");
    }
  }

  return (
    <div className={pageFrameClass}>
      <PageHeader
        title="Create community"
        subtitle="Start with a focused group. You can keep it private or publish it to the catalog."
      />

      <div className="mb-5 grid gap-1 rounded-xl bg-white/[0.025] p-1 ring-1 ring-inset ring-white/[0.06] sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cx(compactTabBaseClass, "justify-center", mode === "manual" ? compactTabActiveClass : compactTabIdleClass)}
        >
          Manual setup
        </button>
        <button
          type="button"
          onClick={() => setMode("agent")}
          className={cx(compactTabBaseClass, "justify-center", mode === "agent" ? compactTabActiveClass : compactTabIdleClass)}
        >
          OpenClaw-assisted
        </button>
      </div>

      {mode === "agent" ? (
        <Surface className="px-4 py-4">
          <SectionTitle
            title="Let OpenClaw draft the hub"
            subtitle="The agent interviews you, prepares JSON, asks for approval, then calls the scoped API."
          />
          <div className="mb-4">
            <p className="text-sm leading-6 text-neutral-400">
              Copy this prompt to your OpenClaw agent. It will interview you, prepare the full JSON, ask for your approval, then create the community through a scoped API token.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyAgentPrompt}
              disabled={agentPromptLoading}
              className={primaryButtonClass}
            >
              {agentPromptCopied ? "Copied" : agentPromptLoading ? "Generating..." : "Copy OpenClaw prompt"}
            </button>
            <button
              type="button"
              onClick={loadAgentPrompt}
              disabled={agentPromptLoading}
              className={subtleButtonClass}
            >
              {agentPromptLoading ? "Generating..." : agentPrompt ? "Regenerate prompt" : "Preview prompt"}
            </button>
          </div>

          {agentPromptError && (
            <div className={cx(errorNoticeClass, "mt-4")}>
              {agentPromptError}
            </div>
          )}

          {agentPrompt && (
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 px-3 py-3 text-xs leading-5 text-neutral-300 ring-1 ring-inset ring-white/[0.08]">
              {agentPrompt}
            </pre>
          )}

          <p className="mt-5 text-xs leading-relaxed text-neutral-600">
            The prompt token expires after one hour. Generate a new prompt if OpenClaw reports an expired token.
          </p>
        </Surface>
      ) : (
      <Surface className="px-4 py-4">
        <SectionTitle title="Manual setup" />
        <form onSubmit={submit} className="space-y-5">
          <Field label="Name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              placeholder="AI Solo Founders"
              className={compactInputClass}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Who belongs here, what the group is for, and how members should use it."
              className={cx(compactTextareaClass, "resize-y")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visibility">
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as CommunityVisibility)}
                className={compactSelectClass}
              >
                <option value="PUBLIC">Public: open link and catalog</option>
                <option value="PRIVATE">Private: direct invite only</option>
              </select>
            </Field>

            <Field label="Profile display">
              <select
                value={profileVisible ? "VISIBLE" : "HIDDEN"}
                onChange={(event) => setProfileVisible(event.target.value === "VISIBLE")}
                className={compactSelectClass}
              >
                <option value="VISIBLE">Show in my profile</option>
                <option value="HIDDEN">Hide from my profile</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select
                value={category}
                onChange={(event) => {
                  const next = event.target.value as CommunityCategory;
                  setCategory(next);
                  setSpecialization(COMMUNITY_SPECIALIZATIONS_BY_CATEGORY[next][0]!);
                }}
                className={compactSelectClass}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {COMMUNITY_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Specialization">
              <select
                value={specialization}
                onChange={(event) => setSpecialization(event.target.value as CommunitySpecialization)}
                className={compactSelectClass}
              >
                {specializations.map((item) => (
                  <option key={item} value={item}>
                    {COMMUNITY_SPECIALIZATION_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {visibility === "PRIVATE" && (
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Private groups are not listed in Communities. People can enter only through a direct invite.
            </div>
          )}

          {error && (
            <div className={errorNoticeClass}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cx(primaryButtonClass, "w-full")}
          >
            {submitting ? "Creating..." : "Create community"}
          </button>
        </form>
      </Surface>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      {children}
    </label>
  );
}
