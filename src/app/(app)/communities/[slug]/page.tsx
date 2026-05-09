"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_SPECIALIZATION_LABELS,
} from "@/types/community";
import {
  MetricCard,
  PageHeader,
  SectionTitle,
  SoftSurface,
  Surface,
  cx,
  getMattePillClass,
  inputClass,
  pageFrameClass,
  primaryButtonClass,
  primaryButtonSmallClass,
  subtleButtonClass,
  subtleButtonSmallClass,
  tabActiveClass,
  tabBaseClass,
  tabIdleClass,
} from "@/components/ui/app-chrome";

type Tab = "overview" | "chat" | "hub" | "strategy";

interface CommunityDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  profileVisibility: "VISIBLE" | "HIDDEN";
  category: keyof typeof COMMUNITY_CATEGORY_LABELS | null;
  specialization: keyof typeof COMMUNITY_SPECIALIZATION_LABELS | null;
  ssotEnabled: boolean;
  knowledgeSummary: string | null;
  strategyEnabled: boolean;
  strategyIntervalHours: number;
  lastStrategySessionAt: string | null;
  nextStrategySessionAt: string | null;
  strategyTokenLimit: number;
  monthlyTokenLimit: number | null;
  strategyUsdLimit: number | null;
  monthlyUsdLimit: number | null;
  judgeIterationLimit: number;
  memberCount: number;
  owner: { id: string; name: string | null; image: string | null };
  members: Array<{
    ownerId: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    name: string | null;
    image: string | null;
  }>;
  viewer: {
    isMember: boolean;
    canManage: boolean;
    isOwner: boolean;
  };
}

interface CommunityChatState {
  locked: boolean;
  memberCount: number;
  requiredMembers: number;
  chat: { id: string; status: string; createdAt: string } | null;
  messages: Array<{
    id: string;
    fromOwnerId: string | null;
    fromOwner: { id: string; name: string | null; image: string | null } | null;
    kind: "HUMAN" | "SYSTEM" | "STRATEGY_SUMMARY";
    content: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  unreadCount: number;
}

interface HubState {
  community: CommunityDetail & {
    _count: {
      knowledgeSources: number;
      knowledgeDocuments: number;
      knowledgeChunks: number;
      channels: number;
      strategySessions: number;
    };
  };
  budget: {
    sessionTokenLimit: number;
    monthlyTokenLimit: number | null;
    strategyUsdLimit: number | null;
    monthlyUsdLimit: number | null;
    monthTokensUsed: number;
    monthCostUsd: number;
    remainingMonthlyTokens: number | null;
    remainingMonthlyUsd: number | null;
  };
  channels: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    semanticQuery: string | null;
  }>;
  sources: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    lastSuccessfulSyncAt: string | null;
    lastError: string | null;
  }>;
  documents: Array<{
    id: string;
    title: string;
    summary: string | null;
    distilledContent: string | null;
    tags: string[];
    privacyLevel: string;
    status: string;
    chunks: number;
    source: { name: string; type: string; status: string };
    updatedAt: string;
  }>;
  viewer: { role: string; canManage: boolean };
}

interface StrategyState {
  sessions: Array<{
    id: string;
    status: string;
    scheduledFor: string;
    startedAt: string | null;
    completedAt: string | null;
    tokensUsed: number;
    tokenLimit: number;
    costUsd: number;
    summary: string | null;
    failureReason: string | null;
    partnershipCandidates: unknown;
    turns: Array<{
      id: string;
      role: "SYSTEM" | "PARTICIPANT" | "JUDGE";
      round: number;
      output: unknown;
      tokensInput: number;
      tokensOutput: number;
      createdAt: string;
    }>;
    actionProposals: Array<{
      id: string;
      type: string;
      status: string;
      title: string;
      summary: string;
      judgeConfidence: number | null;
      createdAt: string;
    }>;
  }>;
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "Chat" },
  { id: "hub", label: "Context Hub" },
  { id: "strategy", label: "Strategy" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "No cap";
  return new Intl.NumberFormat().format(value);
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) return "No cap";
  return `$${value.toFixed(2)}`;
}

function asPrettyJson(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default function CommunityDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [chat, setChat] = useState<CommunityChatState | null>(null);
  const [hub, setHub] = useState<HubState | null>(null);
  const [strategy, setStrategy] = useState<StrategyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [manualPrivacy, setManualPrivacy] = useState("COMMUNITY");
  const [sourceType, setSourceType] = useState("GITHUB");
  const [sourceName, setSourceName] = useState("");
  const [sourceConfig, setSourceConfig] = useState('{\n  "owner": "",\n  "repo": ""\n}');
  const [channelSlug, setChannelSlug] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCommunity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${slug}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load community");
      setCommunity(data.community);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load community");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadChat = useCallback(async (communityId: string) => {
    const res = await fetch(`/api/communities/${communityId}/chat`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Failed to load community chat");
    setChat(data);
  }, []);

  const loadHub = useCallback(async (communityId: string) => {
    const res = await fetch(`/api/communities/${communityId}/hub`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Failed to load context hub");
    setHub(data);
  }, []);

  const loadStrategy = useCallback(async (communityId: string) => {
    const res = await fetch(`/api/communities/${communityId}/strategy/sessions`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Failed to load strategy sessions");
    setStrategy(data);
  }, []);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    if (!community) return;
    if (activeTab === "overview") return;
    if (activeTab === "strategy" && !community.viewer.canManage) return;

    let cancelled = false;
    async function loadTab() {
      if (!community) return;
      setTabLoading(true);
      setError(null);
      try {
        if (activeTab === "chat") await loadChat(community.id);
        if (activeTab === "hub") await loadHub(community.id);
        if (activeTab === "strategy") await loadStrategy(community.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tab");
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    }
    loadTab();
    return () => {
      cancelled = true;
    };
  }, [activeTab, community, loadChat, loadHub, loadStrategy]);

  async function join() {
    if (!community) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${community.id}/join`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to join community");
      setCommunity(data.community);
      if (activeTab === "chat") await loadChat(data.community.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join community");
    } finally {
      setActionLoading(false);
    }
  }

  async function leave() {
    if (!community) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${community.id}/leave`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to leave community");
      await loadCommunity();
      setChat(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave community");
    } finally {
      setActionLoading(false);
    }
  }

  async function sendChatMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || !messageText.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${community.id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to send message");
      setMessageText("");
      await loadChat(community.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setActionLoading(false);
    }
  }

  async function addManualContext(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/communities/${community.id}/knowledge/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: manualTitle,
          rawContent: manualContent,
          privacyLevel: manualPrivacy,
          tags: manualTags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add context");
      setManualTitle("");
      setManualContent("");
      setManualTags("");
      setNotice(data?.skipped ? "Context already up to date" : "Context added to hub");
      await loadHub(community.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add context");
    } finally {
      setActionLoading(false);
    }
  }

  async function addSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      let config = {};
      if (sourceConfig.trim()) {
        config = JSON.parse(sourceConfig);
      }
      const res = await fetch(`/api/communities/${community.id}/knowledge/sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: sourceType, name: sourceName, config }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add source");
      setSourceName("");
      setNotice("Source connected");
      await loadHub(community.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add source");
    } finally {
      setActionLoading(false);
    }
  }

  async function addChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/communities/${community.id}/knowledge/channels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: channelSlug,
          name: channelName,
          semanticQuery: channelQuery || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add channel");
      setChannelSlug("");
      setChannelName("");
      setChannelQuery("");
      setNotice("Channel saved");
      await loadHub(community.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add channel");
    } finally {
      setActionLoading(false);
    }
  }

  async function runStrategy() {
    if (!community) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/communities/${community.id}/strategy/run`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to run strategy session");
      setNotice(data?.skipped ? `Skipped: ${data.reason}` : "Strategy session completed");
      await Promise.all([loadStrategy(community.id), loadCommunity(), loadChat(community.id).catch(() => null)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run strategy session");
    } finally {
      setActionLoading(false);
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

  const specialization = community.specialization
    ? COMMUNITY_SPECIALIZATION_LABELS[community.specialization]
    : community.category
    ? COMMUNITY_CATEGORY_LABELS[community.category]
    : "Custom community";

  return (
    <div className={pageFrameClass}>
      <PageHeader
        title={community.name}
        subtitle={specialization}
        action={
          community.viewer.canManage ? (
            <Link href={`/communities/${community.slug}/settings`} className={subtleButtonClass}>
              Settings
            </Link>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(tabBaseClass, activeTab === tab.id ? tabActiveClass : tabIdleClass)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {activeTab === "overview" && (
        <OverviewTab
          community={community}
          actionLoading={actionLoading}
          onJoin={join}
          onLeave={leave}
        />
      )}
      {activeTab === "chat" && (
        <ChatTab
          community={community}
          chat={chat}
          loading={tabLoading}
          actionLoading={actionLoading}
          messageText={messageText}
          setMessageText={setMessageText}
          onSubmit={sendChatMessage}
        />
      )}
      {activeTab === "hub" && (
        <HubTab
          community={community}
          hub={hub}
          loading={tabLoading}
          actionLoading={actionLoading}
          manualTitle={manualTitle}
          manualContent={manualContent}
          manualTags={manualTags}
          manualPrivacy={manualPrivacy}
          sourceType={sourceType}
          sourceName={sourceName}
          sourceConfig={sourceConfig}
          channelSlug={channelSlug}
          channelName={channelName}
          channelQuery={channelQuery}
          setManualTitle={setManualTitle}
          setManualContent={setManualContent}
          setManualTags={setManualTags}
          setManualPrivacy={setManualPrivacy}
          setSourceType={setSourceType}
          setSourceName={setSourceName}
          setSourceConfig={setSourceConfig}
          setChannelSlug={setChannelSlug}
          setChannelName={setChannelName}
          setChannelQuery={setChannelQuery}
          addManualContext={addManualContext}
          addSource={addSource}
          addChannel={addChannel}
        />
      )}
      {activeTab === "strategy" && (
        <StrategyTab
          community={community}
          strategy={strategy}
          loading={tabLoading}
          actionLoading={actionLoading}
          onRun={runStrategy}
        />
      )}
    </div>
  );
}

function OverviewTab({
  community,
  actionLoading,
  onJoin,
  onLeave,
}: {
  community: CommunityDetail;
  actionLoading: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  return (
    <>
      <Surface className="mb-6 px-5 py-5">
        <div className="mb-5 flex flex-wrap gap-2">
          <span className={getMattePillClass(community.visibility === "PUBLIC" ? "neutral" : "muted", "text-xs")}>
            {community.visibility === "PUBLIC" ? "Public" : "Private"}
          </span>
          <span className={getMattePillClass("muted", "text-xs")}>{community.memberCount} members</span>
          <span className={getMattePillClass(community.ssotEnabled ? "success" : "muted", "text-xs")}>
            SSOT {community.ssotEnabled ? "enabled" : "off"}
          </span>
          <span className={getMattePillClass(community.strategyEnabled ? "info" : "muted", "text-xs")}>
            Strategy {community.strategyEnabled ? `${community.strategyIntervalHours}h` : "off"}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-neutral-300">
          {community.description ?? "No description yet."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricCard value={formatNumber(community.strategyTokenLimit)} label="Tokens per session" />
          <MetricCard value={formatNumber(community.monthlyTokenLimit)} label="Monthly token cap" />
          <MetricCard value={formatUsd(community.monthlyUsdLimit)} label="Monthly USD cap" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <p className="text-xs text-neutral-500">Owned by {community.owner.name ?? "Gennety member"}</p>
          {community.viewer.isMember ? (
            community.viewer.isOwner ? (
              <span className="text-xs text-neutral-500">You own this community</span>
            ) : (
              <button onClick={onLeave} disabled={actionLoading} className={subtleButtonSmallClass}>
                {actionLoading ? "Leaving..." : "Leave"}
              </button>
            )
          ) : (
            <button
              onClick={onJoin}
              disabled={community.visibility !== "PUBLIC" || actionLoading}
              className={primaryButtonSmallClass}
            >
              {actionLoading ? "Joining..." : community.visibility === "PUBLIC" ? "Join community" : "Invite only"}
            </button>
          )}
        </div>
      </Surface>

      <Surface className="px-5 py-5">
        <SectionTitle title="Members" />
        <div className="grid gap-3 sm:grid-cols-2">
          {community.members.map((member) => (
            <Link key={member.ownerId} href={`/u/${member.ownerId}`} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-4 py-3 ring-1 ring-inset ring-white/[0.05] transition-colors hover:bg-white/[0.04]">
              {member.image ? (
                <img src={member.image} alt={member.name ?? "Member"} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-neutral-400">
                  {member.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{member.name ?? "Gennety member"}</p>
                <p className="text-xs text-neutral-600">{member.role.toLowerCase()}</p>
              </div>
            </Link>
          ))}
        </div>
      </Surface>
    </>
  );
}

function ChatTab({
  community,
  chat,
  loading,
  actionLoading,
  messageText,
  setMessageText,
  onSubmit,
}: {
  community: CommunityDetail;
  chat: CommunityChatState | null;
  loading: boolean;
  actionLoading: boolean;
  messageText: string;
  setMessageText: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (!community.viewer.isMember) {
    return <Surface className="px-5 py-5 text-sm text-neutral-400">Join this community to open the shared chat.</Surface>;
  }
  if (loading || !chat) {
    return <Surface className="px-5 py-5 text-sm text-neutral-400">Loading chat...</Surface>;
  }
  if (chat.locked) {
    return (
      <Surface className="px-5 py-5">
        <SectionTitle title="Community chat" />
        <p className="text-sm text-neutral-400">
          Shared chat opens when the hub has at least {chat.requiredMembers} active members.
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="px-5 py-5">
      <SectionTitle title="Community chat" />
      <div className="mb-4 max-h-[520px] space-y-3 overflow-y-auto rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.06]">
        {chat.messages.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-neutral-500">No messages yet.</p>
        ) : (
          chat.messages.map((message) => (
            <div key={message.id} className={cx("rounded-xl px-4 py-3", message.kind === "HUMAN" ? "bg-white/[0.04]" : "bg-sky-950/30")}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-300">
                  {message.kind === "HUMAN"
                    ? message.fromOwner?.name ?? "Community member"
                    : message.kind === "STRATEGY_SUMMARY"
                    ? "Strategy session"
                    : "System"}
                </span>
                <span className="text-[11px] text-neutral-600">{formatDate(message.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-200">{message.content}</p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder="Write to the community"
          className={cx(inputClass, "min-w-0 flex-1")}
        />
        <button type="submit" disabled={actionLoading || !messageText.trim()} className={primaryButtonClass}>
          Send
        </button>
      </form>
    </Surface>
  );
}

function HubTab(props: {
  community: CommunityDetail;
  hub: HubState | null;
  loading: boolean;
  actionLoading: boolean;
  manualTitle: string;
  manualContent: string;
  manualTags: string;
  manualPrivacy: string;
  sourceType: string;
  sourceName: string;
  sourceConfig: string;
  channelSlug: string;
  channelName: string;
  channelQuery: string;
  setManualTitle: (value: string) => void;
  setManualContent: (value: string) => void;
  setManualTags: (value: string) => void;
  setManualPrivacy: (value: string) => void;
  setSourceType: (value: string) => void;
  setSourceName: (value: string) => void;
  setSourceConfig: (value: string) => void;
  setChannelSlug: (value: string) => void;
  setChannelName: (value: string) => void;
  setChannelQuery: (value: string) => void;
  addManualContext: (event: React.FormEvent<HTMLFormElement>) => void;
  addSource: (event: React.FormEvent<HTMLFormElement>) => void;
  addChannel: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { community, hub, loading } = props;
  if (!community.viewer.isMember) {
    return <Surface className="px-5 py-5 text-sm text-neutral-400">Join this community to open the context hub.</Surface>;
  }
  if (loading || !hub) {
    return <Surface className="px-5 py-5 text-sm text-neutral-400">Loading context hub...</Surface>;
  }

  return (
    <div className="space-y-6">
      <Surface className="px-5 py-5">
        <SectionTitle title="Context Hub" />
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard value={hub.community._count.knowledgeDocuments} label="Documents" />
          <MetricCard value={hub.community._count.knowledgeChunks} label="Vector chunks" />
          <MetricCard value={hub.community._count.knowledgeSources} label="Sources" />
          <MetricCard value={hub.community._count.channels} label="Channels" />
        </div>
        <SoftSurface className="mt-4 px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-300">
            {hub.community.knowledgeSummary ?? "No strategy or knowledge summary has been generated yet."}
          </p>
        </SoftSurface>
      </Surface>

      {hub.viewer.canManage && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Surface className="px-5 py-5">
            <SectionTitle title="Add context" />
            <form onSubmit={props.addManualContext} className="space-y-3">
              <input value={props.manualTitle} onChange={(event) => props.setManualTitle(event.target.value)} placeholder="Title" className={inputClass} />
              <textarea value={props.manualContent} onChange={(event) => props.setManualContent(event.target.value)} rows={6} placeholder="Distilled context, decisions, open questions" className={cx(inputClass, "resize-none leading-6")} />
              <input value={props.manualTags} onChange={(event) => props.setManualTags(event.target.value)} placeholder="tags, separated, by comma" className={inputClass} />
              <select value={props.manualPrivacy} onChange={(event) => props.setManualPrivacy(event.target.value)} className={inputClass}>
                <option value="COMMUNITY">Community</option>
                <option value="ADMINS">Admins</option>
                <option value="OWNER_ONLY">Owner only</option>
                <option value="PUBLIC">Public</option>
              </select>
              <button type="submit" disabled={props.actionLoading} className={primaryButtonClass}>Add to SSOT</button>
            </form>
          </Surface>

          <Surface className="px-5 py-5">
            <SectionTitle title="Connect source" />
            <form onSubmit={props.addSource} className="space-y-3">
              <select value={props.sourceType} onChange={(event) => props.setSourceType(event.target.value)} className={inputClass}>
                <option value="GITHUB">GitHub</option>
                <option value="NOTION">Notion</option>
                <option value="MANUAL">Manual</option>
              </select>
              <input value={props.sourceName} onChange={(event) => props.setSourceName(event.target.value)} placeholder="Source name" className={inputClass} />
              <textarea value={props.sourceConfig} onChange={(event) => props.setSourceConfig(event.target.value)} rows={6} className={cx(inputClass, "resize-none font-mono text-xs leading-5")} />
              <button type="submit" disabled={props.actionLoading} className={primaryButtonClass}>Save source</button>
            </form>
          </Surface>

          <Surface className="px-5 py-5">
            <SectionTitle title="Create channel" />
            <form onSubmit={props.addChannel} className="space-y-3">
              <input value={props.channelSlug} onChange={(event) => props.setChannelSlug(event.target.value)} placeholder="channel-slug" className={inputClass} />
              <input value={props.channelName} onChange={(event) => props.setChannelName(event.target.value)} placeholder="Channel name" className={inputClass} />
              <textarea value={props.channelQuery} onChange={(event) => props.setChannelQuery(event.target.value)} rows={6} placeholder="Semantic retrieval focus" className={cx(inputClass, "resize-none leading-6")} />
              <button type="submit" disabled={props.actionLoading} className={primaryButtonClass}>Save channel</button>
            </form>
          </Surface>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Surface className="px-5 py-5">
          <SectionTitle title="Channels" />
          <div className="space-y-3">
            {hub.channels.length === 0 ? <p className="text-sm text-neutral-500">No channels yet.</p> : hub.channels.map((channel) => (
              <SoftSurface key={channel.id} className="px-4 py-3">
                <p className="text-sm font-medium text-white">{channel.name}</p>
                <p className="mt-1 text-xs text-neutral-500">{channel.slug}</p>
                {channel.semanticQuery && <p className="mt-2 text-xs leading-5 text-neutral-400">{channel.semanticQuery}</p>}
              </SoftSurface>
            ))}
          </div>
        </Surface>

        <Surface className="px-5 py-5">
          <SectionTitle title="Sources" />
          <div className="space-y-3">
            {hub.sources.length === 0 ? <p className="text-sm text-neutral-500">No sources yet.</p> : hub.sources.map((source) => (
              <SoftSurface key={source.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{source.name}</p>
                  <span className={getMattePillClass(source.status === "ACTIVE" ? "success" : "warning", "text-[11px]")}>{source.status}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{source.type} · {formatDate(source.lastSuccessfulSyncAt)}</p>
                {source.lastError && <p className="mt-2 text-xs leading-5 text-red-200">{source.lastError}</p>}
              </SoftSurface>
            ))}
          </div>
        </Surface>

        <Surface className="px-5 py-5">
          <SectionTitle title="Budget" />
          <div className="space-y-3">
            <MetricCard value={formatNumber(hub.budget.monthTokensUsed)} label="Tokens used this month" />
            <MetricCard value={`$${hub.budget.monthCostUsd.toFixed(4)}`} label="USD used this month" />
            <MetricCard value={formatNumber(hub.budget.remainingMonthlyTokens)} label="Remaining monthly tokens" />
          </div>
        </Surface>
      </div>

      <Surface className="px-5 py-5">
        <SectionTitle title="Documents" />
        <div className="space-y-3">
          {hub.documents.length === 0 ? <p className="text-sm text-neutral-500">No documents indexed yet.</p> : hub.documents.map((document) => (
            <SoftSurface key={document.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{document.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{document.source.name} · {document.privacyLevel} · {document.chunks} chunks</p>
                </div>
                <span className={getMattePillClass(document.status === "ACTIVE" ? "success" : "warning", "text-[11px]")}>{document.status}</span>
              </div>
              {document.summary && <p className="mt-3 text-sm leading-6 text-neutral-300">{document.summary}</p>}
              {document.distilledContent && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs leading-5 text-neutral-400">{document.distilledContent}</pre>}
            </SoftSurface>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function StrategyTab({
  community,
  strategy,
  loading,
  actionLoading,
  onRun,
}: {
  community: CommunityDetail;
  strategy: StrategyState | null;
  loading: boolean;
  actionLoading: boolean;
  onRun: () => void;
}) {
  if (!community.viewer.canManage) {
    return <Surface className="px-5 py-5 text-sm text-neutral-400">Only owners and admins can view strategy sessions.</Surface>;
  }
  if (loading || !strategy) {
    return <Surface className="px-5 py-5 text-sm text-neutral-400">Loading strategy sessions...</Surface>;
  }

  return (
    <div className="space-y-6">
      <Surface className="px-5 py-5">
        <SectionTitle
          title="Strategy engine"
          action={<button type="button" onClick={onRun} disabled={actionLoading || !community.strategyEnabled} className={primaryButtonSmallClass}>Run now</button>}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard value={community.strategyEnabled ? "On" : "Off"} label="Status" />
          <MetricCard value={`${community.strategyIntervalHours}h`} label="Cycle" />
          <MetricCard value={formatDate(community.nextStrategySessionAt)} label="Next session" />
          <MetricCard value={community.judgeIterationLimit} label="Judge iterations" />
        </div>
      </Surface>

      {strategy.sessions.length === 0 ? (
        <Surface className="px-5 py-5 text-sm text-neutral-500">No strategy sessions yet.</Surface>
      ) : (
        strategy.sessions.map((session) => (
          <Surface key={session.id} className="px-5 py-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">{formatDate(session.startedAt ?? session.scheduledFor)}</h2>
                  <span className={getMattePillClass(session.status === "COMPLETED" ? "success" : session.status === "FAILED" ? "warning" : "info", "text-[11px]")}>{session.status}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{formatNumber(session.tokensUsed)} / {formatNumber(session.tokenLimit)} tokens · ${session.costUsd.toFixed(4)}</p>
              </div>
            </div>
            {session.summary && <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{session.summary}</p>}
            {session.failureReason && <p className="mb-4 text-sm text-red-200">{session.failureReason}</p>}

            <div className="space-y-3">
              {session.turns.map((turn) => (
                <SoftSurface key={turn.id} className="px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-neutral-300">Round {turn.round} · {turn.role}</span>
                    <span className="text-[11px] text-neutral-600">{formatNumber(turn.tokensInput + turn.tokensOutput)} tokens</span>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-neutral-300">{asPrettyJson(turn.output)}</pre>
                </SoftSurface>
              ))}
            </div>

            {session.actionProposals.length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-xs font-medium uppercase text-neutral-500">Action proposals</p>
                {session.actionProposals.map((proposal) => (
                  <SoftSurface key={proposal.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{proposal.title}</p>
                      <span className={getMattePillClass("muted", "text-[11px]")}>{proposal.status}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{proposal.summary}</p>
                  </SoftSurface>
                ))}
              </div>
            )}
          </Surface>
        ))
      )}
    </div>
  );
}
