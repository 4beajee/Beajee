"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_SPECIALIZATION_LABELS,
} from "@/types/community";
import {
  CompactMetric,
  EmptyState,
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
  getMattePillClass,
  listRowClass,
  noticeClass,
  pageFrameClass,
  primaryButtonSmallClass,
  subtleButtonClass,
  subtleButtonSmallClass,
  toolbarButtonClass,
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
  createdAt: string;
  updatedAt: string;
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

function statusTone(status: string): "success" | "warning" | "muted" {
  if (["ACTIVE", "OPEN", "COMPLETED"].includes(status)) return "success";
  if (["FAILED", "DEGRADED", "SKIPPED_BUDGET"].includes(status)) return "warning";
  return "muted";
}

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
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
  const tabCount = (tab: Tab) => {
    if (tab === "chat" && chat && !chat.locked) return chat.messages.length;
    if (tab === "hub" && hub) return hub.community._count.knowledgeDocuments;
    if (tab === "strategy" && strategy) return strategy.sessions.length;
    return null;
  };

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

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.025] p-1 ring-1 ring-inset ring-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              compactTabBaseClass,
              activeTab === tab.id ? compactTabActiveClass : compactTabIdleClass
            )}
          >
            <span>{tab.label}</span>
            {tabCount(tab.id) !== null ? (
              <span className="ml-2 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-neutral-300">
                {tabCount(tab.id)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {notice && <div className={cx(noticeClass, "mb-4")}>{notice}</div>}
      {error && <div className={cx(errorNoticeClass, "mb-4")}>{error}</div>}

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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
      <Surface className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={getMattePillClass(community.visibility === "PUBLIC" ? "neutral" : "muted", "text-[11px]")}>
                {community.visibility === "PUBLIC" ? "Public" : "Private"}
              </span>
              <span className={getMattePillClass("muted", "text-[11px]")}>{community.memberCount} members</span>
              <span className={getMattePillClass(community.ssotEnabled ? "success" : "muted", "text-[11px]")}>
                SSOT {community.ssotEnabled ? "on" : "off"}
              </span>
              <span className={getMattePillClass(community.strategyEnabled ? "info" : "muted", "text-[11px]")}>
                Strategy {community.strategyEnabled ? `${community.strategyIntervalHours}h` : "off"}
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-neutral-300">
              {community.description ?? "No description yet."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {community.viewer.isMember ? (
              community.viewer.isOwner ? (
                <span className={getMattePillClass("muted", "text-[11px]")}>Owner</span>
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
                {actionLoading ? "Joining..." : community.visibility === "PUBLIC" ? "Join" : "Invite only"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetric value={formatNumber(community.strategyTokenLimit)} label="Session tokens" />
          <CompactMetric value={formatNumber(community.monthlyTokenLimit)} label="Monthly tokens" />
          <CompactMetric value={formatUsd(community.monthlyUsdLimit)} label="Monthly USD" />
          <CompactMetric value={formatDate(community.nextStrategySessionAt)} label="Next strategy" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-xs text-neutral-500">Owned by {community.owner.name ?? "Gennety member"}</p>
          <p className="text-xs text-neutral-600">
            Created {formatDate(community.createdAt)}
          </p>
        </div>
      </Surface>

      <Surface className="px-4 py-4">
        <SectionTitle title="Members" action={<span className={getMattePillClass("muted", "text-[11px]")}>{community.memberCount}</span>} />
        <div className="space-y-2">
          {community.members.map((member) => (
            <Link key={member.ownerId} href={`/u/${member.ownerId}`} className={cx(listRowClass, "flex items-center gap-3")}>
              {member.image ? (
                <img src={member.image} alt={member.name ?? "Member"} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-400">
                  {member.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{member.name ?? "Gennety member"}</p>
                <p className="text-xs text-neutral-600">{roleLabel(member.role)}</p>
              </div>
              <span className={getMattePillClass(member.role === "OWNER" ? "neutral" : "muted", "text-[10px]")}>
                {roleLabel(member.role)}
              </span>
            </Link>
          ))}
        </div>
      </Surface>
    </div>
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
    return <EmptyState>Join this community to open the shared chat.</EmptyState>;
  }
  if (loading || !chat) {
    return <EmptyState>Loading chat...</EmptyState>;
  }
  if (chat.locked) {
    return (
      <Surface className="px-4 py-4">
        <SectionTitle title="Community chat" action={<span className={getMattePillClass("muted", "text-[11px]")}>{chat.memberCount}/{chat.requiredMembers}</span>} />
        <p className="text-sm text-neutral-400">
          Shared chat opens when the hub has at least {chat.requiredMembers} active members.
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="px-4 py-4">
      <SectionTitle
        title="Community chat"
        subtitle={`${chat.memberCount} active members`}
        action={chat.unreadCount > 0 ? <span className={getMattePillClass("info", "text-[11px]")}>{chat.unreadCount} unread</span> : null}
      />
      <div className="mb-3 max-h-[520px] space-y-2 overflow-y-auto rounded-lg bg-black/20 p-2 ring-1 ring-inset ring-white/[0.06]">
        {chat.messages.length === 0 ? (
          <EmptyState className="border-0 bg-transparent">No messages yet.</EmptyState>
        ) : (
          chat.messages.map((message) => (
            <div
              key={message.id}
              className={cx(
                "rounded-lg px-3 py-2.5",
                message.kind === "HUMAN"
                  ? "bg-white/[0.04]"
                  : message.kind === "STRATEGY_SUMMARY"
                  ? "bg-indigo-950/35 ring-1 ring-inset ring-indigo-300/10"
                  : "bg-white/[0.025] text-neutral-400"
              )}
            >
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
              <p className="whitespace-pre-wrap text-sm leading-5 text-neutral-200">{message.content}</p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder="Write to the community"
          className={cx(compactInputClass, "min-w-0 flex-1")}
        />
        <button type="submit" disabled={actionLoading || !messageText.trim()} className={primaryButtonSmallClass}>
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
  const [managerPanel, setManagerPanel] = useState<"context" | "source" | "channel" | null>(null);

  if (!community.viewer.isMember) {
    return <EmptyState>Join this community to open the context hub.</EmptyState>;
  }
  if (loading || !hub) {
    return <EmptyState>Loading context hub...</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <Surface className="px-4 py-4">
        <SectionTitle
          title="Context Hub"
          subtitle="Single source of truth for this community"
          action={
            hub.viewer.canManage ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setManagerPanel(managerPanel === "context" ? null : "context")} className={toolbarButtonClass}>
                  Add context
                </button>
                <button type="button" onClick={() => setManagerPanel(managerPanel === "source" ? null : "source")} className={toolbarButtonClass}>
                  Connect source
                </button>
                <button type="button" onClick={() => setManagerPanel(managerPanel === "channel" ? null : "channel")} className={toolbarButtonClass}>
                  New channel
                </button>
              </div>
            ) : null
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetric value={hub.community._count.knowledgeDocuments} label="Documents" />
          <CompactMetric value={hub.community._count.knowledgeChunks} label="Vector chunks" />
          <CompactMetric value={hub.community._count.knowledgeSources} label="Sources" />
          <CompactMetric value={hub.community._count.channels} label="Channels" />
        </div>
        <div className="mt-4 rounded-lg bg-white/[0.025] px-3 py-3 ring-1 ring-inset ring-white/[0.06]">
          <p className="whitespace-pre-wrap text-sm leading-5 text-neutral-300">
            {hub.community.knowledgeSummary ?? "No strategy or knowledge summary has been generated yet."}
          </p>
        </div>
      </Surface>

      {hub.viewer.canManage && managerPanel && (
        <Surface className="px-4 py-4">
          {managerPanel === "context" && (
            <form onSubmit={props.addManualContext} className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-3">
                <label className="block">
                  <span className={fieldLabelClass}>Title</span>
                  <input value={props.manualTitle} onChange={(event) => props.setManualTitle(event.target.value)} placeholder="Decision log" className={compactInputClass} />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Tags</span>
                  <input value={props.manualTags} onChange={(event) => props.setManualTags(event.target.value)} placeholder="strategy, roadmap" className={compactInputClass} />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Privacy</span>
                  <select value={props.manualPrivacy} onChange={(event) => props.setManualPrivacy(event.target.value)} className={compactSelectClass}>
                    <option value="COMMUNITY">Community</option>
                    <option value="ADMINS">Admins</option>
                    <option value="OWNER_ONLY">Owner only</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className={fieldLabelClass}>Context</span>
                <textarea value={props.manualContent} onChange={(event) => props.setManualContent(event.target.value)} rows={5} placeholder="Distilled context, decisions, open questions" className={cx(compactTextareaClass, "resize-y")} />
                <button type="submit" disabled={props.actionLoading} className={cx(primaryButtonSmallClass, "mt-3")}>Add to SSOT</button>
              </label>
            </form>
          )}

          {managerPanel === "source" && (
            <form onSubmit={props.addSource} className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-3">
                <label className="block">
                  <span className={fieldLabelClass}>Type</span>
                  <select value={props.sourceType} onChange={(event) => props.setSourceType(event.target.value)} className={compactSelectClass}>
                    <option value="GITHUB">GitHub</option>
                    <option value="NOTION">Notion</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Source name</span>
                  <input value={props.sourceName} onChange={(event) => props.setSourceName(event.target.value)} placeholder="Product repo" className={compactInputClass} />
                </label>
              </div>
              <label className="block">
                <span className={fieldLabelClass}>Config JSON</span>
                <textarea value={props.sourceConfig} onChange={(event) => props.setSourceConfig(event.target.value)} rows={5} className={cx(compactTextareaClass, "resize-y font-mono text-xs leading-5")} />
                <button type="submit" disabled={props.actionLoading} className={cx(primaryButtonSmallClass, "mt-3")}>Save source</button>
              </label>
            </form>
          )}

          {managerPanel === "channel" && (
            <form onSubmit={props.addChannel} className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <span className={fieldLabelClass}>Slug</span>
                <input value={props.channelSlug} onChange={(event) => props.setChannelSlug(event.target.value)} placeholder="strategy" className={compactInputClass} />
              </label>
              <label className="block">
                <span className={fieldLabelClass}>Name</span>
                <input value={props.channelName} onChange={(event) => props.setChannelName(event.target.value)} placeholder="Strategy" className={compactInputClass} />
              </label>
              <label className="block">
                <span className={fieldLabelClass}>Semantic focus</span>
                <input value={props.channelQuery} onChange={(event) => props.setChannelQuery(event.target.value)} placeholder="roadmap, blockers, partner needs" className={compactInputClass} />
              </label>
              <button type="submit" disabled={props.actionLoading} className={primaryButtonSmallClass}>Save</button>
            </form>
          )}
        </Surface>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Surface className="px-4 py-4">
          <SectionTitle title="Documents" action={<span className={getMattePillClass("muted", "text-[11px]")}>{hub.documents.length}</span>} />
          <div className="space-y-2">
            {hub.documents.length === 0 ? <EmptyState>No documents indexed yet.</EmptyState> : hub.documents.map((document) => (
              <div key={document.id} className={listRowClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{document.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">{document.source.name} · {document.privacyLevel} · {document.chunks} chunks</p>
                  </div>
                  <span className={getMattePillClass(statusTone(document.status), "text-[11px]")}>{document.status}</span>
                </div>
                {document.summary && <p className="mt-2 text-sm leading-5 text-neutral-300">{document.summary}</p>}
                {document.distilledContent && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">Show distilled content</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs leading-5 text-neutral-400">{document.distilledContent}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Surface>

        <div className="space-y-5">
          <Surface className="px-4 py-4">
            <SectionTitle title="Budget" />
            <div className="grid gap-2">
              <CompactMetric value={formatNumber(hub.budget.monthTokensUsed)} label="Tokens used this month" />
              <CompactMetric value={`$${hub.budget.monthCostUsd.toFixed(4)}`} label="USD used this month" />
              <CompactMetric value={formatNumber(hub.budget.remainingMonthlyTokens)} label="Remaining monthly tokens" />
            </div>
          </Surface>

          <Surface className="px-4 py-4">
            <SectionTitle title="Sources" />
            <div className="space-y-2">
              {hub.sources.length === 0 ? <EmptyState>No sources yet.</EmptyState> : hub.sources.map((source) => (
                <div key={source.id} className={listRowClass}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{source.name}</p>
                    <span className={getMattePillClass(statusTone(source.status), "text-[11px]")}>{source.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{source.type} · {formatDate(source.lastSuccessfulSyncAt)}</p>
                  {source.lastError && <p className="mt-2 text-xs leading-5 text-red-200">{source.lastError}</p>}
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="px-4 py-4">
            <SectionTitle title="Channels" />
            <div className="space-y-2">
              {hub.channels.length === 0 ? <EmptyState>No channels yet.</EmptyState> : hub.channels.map((channel) => (
                <div key={channel.id} className={listRowClass}>
                  <p className="truncate text-sm font-medium text-white">{channel.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{channel.slug}</p>
                  {channel.semanticQuery && <p className="mt-2 text-xs leading-5 text-neutral-400">{channel.semanticQuery}</p>}
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>
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
    return <EmptyState>Only owners and admins can view strategy sessions.</EmptyState>;
  }
  if (loading || !strategy) {
    return <EmptyState>Loading strategy sessions...</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <Surface className="px-4 py-4">
        <SectionTitle
          title="Strategy engine"
          action={<button type="button" onClick={onRun} disabled={actionLoading || !community.strategyEnabled} className={primaryButtonSmallClass}>Run now</button>}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetric value={community.strategyEnabled ? "On" : "Off"} label="Status" />
          <CompactMetric value={`${community.strategyIntervalHours}h`} label="Cycle" />
          <CompactMetric value={formatDate(community.nextStrategySessionAt)} label="Next session" />
          <CompactMetric value={community.judgeIterationLimit} label="Judge iterations" />
        </div>
      </Surface>

      {strategy.sessions.length === 0 ? (
        <EmptyState>No strategy sessions yet.</EmptyState>
      ) : (
        strategy.sessions.map((session) => (
          <Surface key={session.id} className="px-4 py-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">{formatDate(session.startedAt ?? session.scheduledFor)}</h2>
                  <span className={getMattePillClass(statusTone(session.status), "text-[11px]")}>{session.status}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{formatNumber(session.tokensUsed)} / {formatNumber(session.tokenLimit)} tokens · ${session.costUsd.toFixed(4)}</p>
              </div>
              <span className={getMattePillClass("muted", "text-[11px]")}>{session.actionProposals.length} proposals</span>
            </div>
            {session.summary && <p className="mb-3 whitespace-pre-wrap text-sm leading-5 text-neutral-300">{session.summary}</p>}
            {session.failureReason && <p className="mb-4 text-sm text-red-200">{session.failureReason}</p>}

            <div className="space-y-2">
              {session.turns.map((turn) => (
                <div key={turn.id} className={listRowClass}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-neutral-300">Round {turn.round} · {roleLabel(turn.role)}</span>
                    <span className="text-[11px] text-neutral-600">{formatNumber(turn.tokensInput + turn.tokensOutput)} tokens</span>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">Raw output</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs leading-5 text-neutral-300">{asPrettyJson(turn.output)}</pre>
                  </details>
                </div>
              ))}
            </div>

            {session.actionProposals.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase text-neutral-500">Action proposals</p>
                {session.actionProposals.map((proposal) => (
                  <div key={proposal.id} className={listRowClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{proposal.title}</p>
                      <span className={getMattePillClass("muted", "text-[11px]")}>{proposal.status}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-neutral-300">{proposal.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        ))
      )}
    </div>
  );
}
