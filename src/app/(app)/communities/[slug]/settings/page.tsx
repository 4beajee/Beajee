"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  compactTextareaClass,
  cx,
  errorNoticeClass,
  fieldLabelClass,
  noticeClass,
  pageFrameClass,
  primaryButtonClass,
  primaryButtonSmallClass,
  subtleButtonClass,
  subtleButtonSmallClass,
  toggleInputClass,
  toggleRowClass,
} from "@/components/ui/app-chrome";

interface CommunitySettings {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CommunityVisibility;
  profileVisibility: "VISIBLE" | "HIDDEN";
  category: CommunityCategory | null;
  specialization: CommunitySpecialization | null;
  ssotEnabled: boolean;
  strategyEnabled: boolean;
  strategyIntervalHours: number;
  strategyTokenLimit: number;
  monthlyTokenLimit: number | null;
  strategyUsdLimit: number | null;
  monthlyUsdLimit: number | null;
  judgeIterationLimit: number;
  viewer: {
    canManage: boolean;
    showOnProfile: boolean;
  };
}

const CATEGORIES = Object.keys(COMMUNITY_CATEGORY_LABELS) as CommunityCategory[];

export default function CommunitySettingsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [community, setCommunity] = useState<CommunitySettings | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CommunityVisibility>("PRIVATE");
  const [profileVisible, setProfileVisible] = useState(true);
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [category, setCategory] = useState<CommunityCategory>("TECHNOLOGY");
  const [specialization, setSpecialization] = useState<CommunitySpecialization>("AI_DEVELOPMENT");
  const [ssotEnabled, setSsotEnabled] = useState(true);
  const [strategyEnabled, setStrategyEnabled] = useState(false);
  const [strategyIntervalHours, setStrategyIntervalHours] = useState("72");
  const [strategyTokenLimit, setStrategyTokenLimit] = useState("80000");
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState("");
  const [strategyUsdLimit, setStrategyUsdLimit] = useState("");
  const [monthlyUsdLimit, setMonthlyUsdLimit] = useState("");
  const [judgeIterationLimit, setJudgeIterationLimit] = useState("3");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/communities/${slug}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to load community");
        const next = data.community as CommunitySettings;
        if (cancelled) return;

        if (!next.viewer.canManage) {
          setError("Only community owners and admins can open settings");
          setCommunity(null);
          return;
        }

        const nextCategory = next.category ?? "TECHNOLOGY";
        const nextSpecialization =
          next.specialization ?? COMMUNITY_SPECIALIZATIONS_BY_CATEGORY[nextCategory][0]!;

        setCommunity(next);
        setName(next.name);
        setDescription(next.description ?? "");
        setVisibility(next.visibility);
        setProfileVisible(next.profileVisibility === "VISIBLE");
        setShowOnProfile(next.viewer.showOnProfile);
        setCategory(nextCategory);
        setSpecialization(nextSpecialization);
        setSsotEnabled(next.ssotEnabled);
        setStrategyEnabled(next.strategyEnabled);
        setStrategyIntervalHours(String(next.strategyIntervalHours ?? 72));
        setStrategyTokenLimit(String(next.strategyTokenLimit ?? 80000));
        setMonthlyTokenLimit(next.monthlyTokenLimit === null ? "" : String(next.monthlyTokenLimit));
        setStrategyUsdLimit(next.strategyUsdLimit === null ? "" : String(next.strategyUsdLimit));
        setMonthlyUsdLimit(next.monthlyUsdLimit === null ? "" : String(next.monthlyUsdLimit));
        setJudgeIterationLimit(String(next.judgeIterationLimit ?? 3));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load community");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/communities/${community.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          visibility,
          profileVisibility: profileVisible ? "VISIBLE" : "HIDDEN",
          category: visibility === "PUBLIC" ? category : category || null,
          specialization: visibility === "PUBLIC" ? specialization : specialization || null,
          ssotEnabled,
          strategyEnabled,
          strategyIntervalHours: Number(strategyIntervalHours),
          strategyTokenLimit: Number(strategyTokenLimit),
          monthlyTokenLimit: monthlyTokenLimit ? Number(monthlyTokenLimit) : null,
          strategyUsdLimit: strategyUsdLimit ? Number(strategyUsdLimit) : null,
          monthlyUsdLimit: monthlyUsdLimit ? Number(monthlyUsdLimit) : null,
          judgeIterationLimit: Number(judgeIterationLimit),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save community");

      const visibilityRes = await fetch(`/api/communities/${community.id}/profile-visibility`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ showOnProfile }),
      });
      const visibilityData = await visibilityRes.json().catch(() => null);
      if (!visibilityRes.ok) {
        throw new Error(visibilityData?.error ?? "Failed to save profile visibility");
      }

      setCommunity(visibilityData.community ?? data.community);
      setMessage("Community updated");
      if (data.community.slug !== slug) {
        router.replace(`/communities/${data.community.slug}/settings`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save community");
    } finally {
      setSaving(false);
    }
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community) return;
    setInviting(true);
    setError(null);
    setMessage(null);
    setInviteUrl(null);

    try {
      const res = await fetch(`/api/communities/${community.id}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteeEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create invite");
      setInviteUrl(data.inviteUrl);
      setInviteeEmail("");
      setMessage(data.emailDelivery?.sent ? "Invite sent" : "Invite link created");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invite");
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    );
  }

  if (error && !community) {
    return (
      <div className={pageFrameClass}>
        <Surface className="px-8 py-8 text-center">
          <p className="text-sm text-neutral-400">{error}</p>
          <Link href="/communities" className="mt-4 inline-flex text-sm text-white hover:text-neutral-300">
            Back to communities
          </Link>
        </Surface>
      </div>
    );
  }

  if (!community) return null;

  return (
    <div className={pageFrameClass}>
      <PageHeader
        title="Community settings"
        subtitle={community.name}
        action={
          <Link href={`/communities/${community.slug}`} className={subtleButtonClass}>
            Open
          </Link>
        }
      />

      <Surface className="mb-5 px-4 py-4">
        <form onSubmit={save} className="space-y-5">
          <SectionTitle title="Identity" />
          <Field label="Name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={compactInputClass}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              className={cx(compactTextareaClass, "resize-y")}
            />
          </Field>

          <SectionTitle title="Visibility" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visibility">
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as CommunityVisibility)}
                className={compactSelectClass}
              >
                <option value="PUBLIC">Public: catalog and open link</option>
                <option value="PRIVATE">Private: direct invite only</option>
              </select>
            </Field>

            <Field label="Profile visibility">
              <select
                value={profileVisible ? "VISIBLE" : "HIDDEN"}
                onChange={(event) => setProfileVisible(event.target.value === "VISIBLE")}
                className={compactSelectClass}
              >
                <option value="VISIBLE">Show this group in owner profile</option>
                <option value="HIDDEN">Hide this group from owner profile</option>
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
                {COMMUNITY_SPECIALIZATIONS_BY_CATEGORY[category].map((item) => (
                  <option key={item} value={item}>
                    {COMMUNITY_SPECIALIZATION_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className={toggleRowClass}>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Context hub</h2>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Controls the indexed SSOT attached to this community.
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={ssotEnabled}
                onChange={(event) => setSsotEnabled(event.target.checked)}
                className={toggleInputClass}
              />
              Enabled
            </label>
          </div>

          <div className="rounded-lg bg-white/[0.025] p-4 ring-1 ring-inset ring-white/[0.07]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Strategy sessions</h2>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Agent debate cycle, budget controls, and judge limits.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={strategyEnabled}
                  onChange={(event) => setStrategyEnabled(event.target.checked)}
                  className={toggleInputClass}
                />
                Enabled
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Interval hours">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={strategyIntervalHours}
                  onChange={(event) => setStrategyIntervalHours(event.target.value)}
                  className={compactInputClass}
                />
              </Field>
              <Field label="Tokens per session">
                <input
                  type="number"
                  min={1000}
                  max={2000000}
                  value={strategyTokenLimit}
                  onChange={(event) => setStrategyTokenLimit(event.target.value)}
                  className={compactInputClass}
                />
              </Field>
              <Field label="Monthly token cap">
                <input
                  type="number"
                  min={1000}
                  max={50000000}
                  value={monthlyTokenLimit}
                  onChange={(event) => setMonthlyTokenLimit(event.target.value)}
                  placeholder="No cap"
                  className={compactInputClass}
                />
              </Field>
              <Field label="USD per session">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={strategyUsdLimit}
                  onChange={(event) => setStrategyUsdLimit(event.target.value)}
                  placeholder="No cap"
                  className={compactInputClass}
                />
              </Field>
              <Field label="Monthly USD cap">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={monthlyUsdLimit}
                  onChange={(event) => setMonthlyUsdLimit(event.target.value)}
                  placeholder="No cap"
                  className={compactInputClass}
                />
              </Field>
              <Field label="Judge iterations">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={judgeIterationLimit}
                  onChange={(event) => setJudgeIterationLimit(event.target.value)}
                  className={compactInputClass}
                />
              </Field>
            </div>
          </div>

          <label className={toggleRowClass}>
            <span>
              <span className="block text-sm font-medium text-white">Show my membership in profile</span>
              <span className="text-xs text-neutral-500">This controls your own membership card.</span>
            </span>
            <input
              type="checkbox"
              checked={showOnProfile}
              onChange={(event) => setShowOnProfile(event.target.checked)}
              className={toggleInputClass}
            />
          </label>

          {message && <div className={noticeClass}>{message}</div>}
          {error && <div className={errorNoticeClass}>{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className={cx(primaryButtonClass, "w-full")}
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
        </form>
      </Surface>

      <Surface className="px-4 py-4">
        <SectionTitle title="Invite people" />
        <form onSubmit={createInvite} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={inviteeEmail}
            onChange={(event) => setInviteeEmail(event.target.value)}
            type="email"
            required
            placeholder="person@example.com"
            className={cx(compactInputClass, "min-w-0 flex-1")}
          />
          <button
            type="submit"
            disabled={inviting}
            className={primaryButtonSmallClass}
          >
            {inviting ? "Inviting..." : "Create invite"}
          </button>
        </form>

        {inviteUrl && (
          <div className="mt-4 rounded-lg bg-white/[0.025] p-3 ring-1 ring-inset ring-white/[0.07]">
            <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Invite link</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                readOnly
                value={inviteUrl}
                className={cx(compactInputClass, "min-w-0 flex-1 text-xs text-neutral-300")}
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className={subtleButtonSmallClass}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </Surface>
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
