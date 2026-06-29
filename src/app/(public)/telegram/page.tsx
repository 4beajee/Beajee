"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { getCountryOptions } from "@/lib/countries";
import { PLATFORM_LABELS } from "@/lib/agent-platform";
import type { AgentPlatform } from "@/types/onboarding";

type Tab = "today" | "matches" | "chats" | "you";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void };
  HapticFeedback?: { impactOccurred?: (style: "light" | "medium" | "heavy") => void; notificationOccurred?: (type: "success" | "warning" | "error") => void };
};

type AuthState = {
  token: string;
  owner: { id: string; name: string | null; onboarded: boolean; schedulingUrl: string | null };
  telegram?: { id: string; username: string | null } | null;
  botUsername?: string | null;
};

type MatchItem = {
  matchId: string;
  status: "PROPOSED" | "MATCHED" | "DORMANT";
  overlapSummary: string;
  framingForMe: string;
  confirmedByMe: boolean;
  confirmedByOther: boolean;
  initiatedByMe: boolean;
  otherPerson: { id: string; name: string | null; image: string | null; currentWork: string | null; expertise: string[]; location: string | null; profession: string | null };
  chatId: string | null;
  unreadCount: number;
  lastMessage: { content: string; fromOwner: string; createdAt: string } | null;
  schedulingRole: "guest" | "host" | null;
  partnerSchedulingUrl: string | null;
  partnerSchedulingProvider: string | null;
  schedulingHostName: string | null;
  call: { status: string; wantsCallByMe: boolean; wantsCallByOther: boolean; zoomUrl: string | null; scheduledAt: string | null } | null;
};

type ChatSummary = {
  matchId: string;
  chatId: string;
  status: string;
  overlapSummary: string;
  otherPerson: { id: string; name: string | null; image: string | null; currentWork: string | null; profession: string | null };
  lastMessage: { content: string; fromOwner: string; createdAt: string } | null;
  unreadCount: number;
};

type ChatDetail = {
  chatId: string;
  matchId: string;
  status: string;
  overlapSummary: string;
  otherPerson: { id: string; name: string | null; image: string | null; currentWork: string | null };
  messages: Array<{ id: string; fromOwner: string; kind: string; content: string; createdAt: string }>;
};

type Settings = {
  name: string | null;
  image: string | null;
  onboarded: boolean;
  networkingGoal: string | null;
  excludedTopics: string[];
  schedulingUrl: string | null;
  agentId: string | null;
  agentPlatform: string | null;
  agentActive: boolean;
  contextPublished: boolean;
  freshnessState: string | null;
  pendingCheckIn: { batchId: string; status: string } | null;
};

const GOALS = [
  ["partnership", "Find a business partner"],
  ["collaboration", "Find collaborators"],
  ["mentor", "Find a mentor"],
  ["peer", "Meet relevant peers"],
] as const;

const PLATFORMS: AgentPlatform[] = ["open_claw", "hermes", "fork", "codex", "claude_code"];
const countries = getCountryOptions("en");

function webApp() {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

function telegramHost() {
  const app = webApp();
  return app?.initData ? app : undefined;
}

function initials(name: string | null) {
  return (name ?? "New connection").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function personLabel(match: MatchItem | ChatSummary | ChatDetail) {
  return match.otherPerson.name ?? "New connection";
}

function Avatar({ name, image, size = "md" }: { name: string | null; image?: string | null; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm";
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={`${dimensions} shrink-0 rounded-full object-cover ring-1 ring-white/10`} />
  ) : (
    <div className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-[#202622] font-semibold text-[#d9ff7a] ring-1 ring-white/10`}>
      {initials(name)}
    </div>
  );
}

function Icon({ name }: { name: Tab }) {
  const path = {
    today: <><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></>,
    matches: <><path d="M8.5 18.5 4 14a4.2 4.2 0 0 1 6-6l2 2 2-2a4.2 4.2 0 0 1 6 6l-4.5 4.5L12 22z"/></>,
    chats: <><path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h8M8 14h5"/></>,
    you: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  }[name];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{path}</svg>;
}

function SectionTitle({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return <div className="mb-5">{eyebrow ? <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#819087]">{eyebrow}</p> : null}<h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em] text-[#f2f5f2]">{children}</h1></div>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="py-16 text-center"><div className="mx-auto mb-5 h-px w-12 bg-[#d9ff7a]"/><p className="text-base font-medium text-[#eef2ee]">{title}</p><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#89938d]">{body}</p></div>;
}

export default function TelegramWebAppPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [freshnessState, setFreshnessState] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    if (!auth?.token) throw new Error("Session is not ready");
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  }, [auth?.token]);

  useEffect(() => {
    const tg = webApp();
    const hostedByTelegram = !!tg?.initData;
    if (hostedByTelegram) {
      tg?.ready?.();
      tg?.expand?.();
      try { tg?.requestFullscreen?.(); } catch { /* Older clients stay expanded. */ }
      tg?.disableVerticalSwipes?.();
    }
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab") as Tab | null;
    if (requestedTab && ["today", "matches", "chats", "you"].includes(requestedTab)) setTab(requestedTab);
    if (params.get("matchId")) setSelectedMatchId(params.get("matchId"));

    const authenticate = async () => {
      try {
        const response = await fetch("/api/telegram/auth", tg?.initData ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
        } : undefined);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Authentication failed");
        setAuth(data);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Authentication failed");
      } finally {
        setLoading(false);
      }
    };
    authenticate();
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!auth?.token) return;
    if (!quiet) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        api("/api/telegram/matches"),
        api("/api/telegram/chats"),
        api("/api/telegram/settings"),
      ]);
      const [matchResult, chatResult, settingsResult] = results;
      if (matchResult.status === "fulfilled") {
        setMatches(matchResult.value.matches ?? []);
        setFreshnessState(matchResult.value.freshnessState ?? null);
      }
      if (chatResult.status === "fulfilled") setChats(chatResult.value.chats ?? []);
      if (settingsResult.status === "fulfilled") setSettings(settingsResult.value.settings ?? null);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected" && !quiet) {
        setNotice(failed.reason instanceof Error ? failed.reason.message : "Some information could not be refreshed");
      }
    } catch {
      if (!quiet) setNotice("Could not refresh Beajee");
    } finally {
      setRefreshing(false);
    }
  }, [api, auth?.token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) refresh(true); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [refresh]);

  const openTab = (next: Tab) => {
    setTab(next); setSelectedMatchId(null); setSelectedChatId(null); setChat(null);
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  };

  const closeDetail = useCallback(() => {
    setSelectedMatchId(null); setSelectedChatId(null); setChat(null);
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  }, [tab]);

  useEffect(() => {
    const back = telegramHost()?.BackButton;
    if (!back) return;
    if (selectedMatchId || selectedChatId) { back.show(); back.onClick(closeDetail); }
    else back.hide();
    return () => back.offClick(closeDetail);
  }, [closeDetail, selectedChatId, selectedMatchId]);

  const openMatch = (matchId: string) => {
    setTab("matches"); setSelectedMatchId(matchId); setSelectedChatId(null);
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("tab", "matches"); url.searchParams.set("matchId", matchId);
    window.history.replaceState({}, "", url);
  };

  const openChat = useCallback(async (matchId: string) => {
    setTab("chats"); setSelectedChatId(matchId); setSelectedMatchId(null); setPending("chat-load");
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("tab", "chats"); url.searchParams.set("matchId", matchId);
    window.history.replaceState({}, "", url);
    try {
      const data = await api(`/api/telegram/chats?matchId=${encodeURIComponent(matchId)}`);
      setChat(data.chat);
      setMessage(localStorage.getItem(`beajee-chat-draft:${matchId}`) ?? "");
      requestAnimationFrame(() => chatEndRef.current?.scrollIntoView());
      refresh(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not open chat"); }
    finally { setPending(null); }
  }, [api, refresh]);

  useEffect(() => {
    if (!selectedChatId) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      api(`/api/telegram/chats?matchId=${encodeURIComponent(selectedChatId)}`)
        .then((data) => setChat(data.chat)).catch(() => undefined);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [api, selectedChatId]);

  const matchAction = async (matchId: string, action: "confirm" | "dormant") => {
    setPending(`${action}:${matchId}`); setNotice(null);
    try {
      await api("/api/telegram/matches", { method: "POST", body: JSON.stringify({ matchId, action }) });
      telegramHost()?.HapticFeedback?.notificationOccurred?.(action === "confirm" ? "success" : "warning");
      await refresh(true);
      setNotice(action === "confirm" ? "Your answer is saved." : "Moved to Not now. No reminders will be sent.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update this match"); telegramHost()?.HapticFeedback?.notificationOccurred?.("error"); }
    finally { setPending(null); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedChatId || !message.trim()) return;
    const content = message.trim(); setPending("send");
    try {
      const data = await api("/api/telegram/chats", { method: "POST", body: JSON.stringify({ matchId: selectedChatId, content }) });
      setChat((current) => current ? { ...current, messages: [...current.messages, data.message] } : current);
      setMessage(""); localStorage.removeItem(`beajee-chat-draft:${selectedChatId}`);
      telegramHost()?.HapticFeedback?.impactOccurred?.("light");
      requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Message was not sent"); }
    finally { setPending(null); }
  };

  const chatAction = async (action: "archive" | "block" | "report", reason?: string) => {
    if (!selectedChatId) return;
    setPending(`chat-${action}`); setNotice(null);
    try {
      await api("/api/telegram/chats", {
        method: "POST",
        body: JSON.stringify({ matchId: selectedChatId, action, reason }),
      });
      setNotice(action === "report" ? "Report submitted for review." : action === "block" ? "User blocked and chat closed." : "Chat archived.");
      await refresh(true);
      if (action !== "report") closeDetail();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update this chat"); }
    finally { setPending(null); }
  };

  const updateSettings = async (body: Record<string, unknown>, success: string) => {
    setPending("settings"); setNotice(null);
    try { await api("/api/telegram/settings", { method: "PATCH", body: JSON.stringify(body) }); await refresh(true); setNotice(success); telegramHost()?.HapticFeedback?.notificationOccurred?.("success"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not save settings"); }
    finally { setPending(null); }
  };

  if (loading) return <LoadingScreen />;
  if (authError || !auth) return <AuthRecovery error={authError} />;
  if (!auth.owner.onboarded || (settings && !settings.agentId)) {
    return <Onboarding auth={auth} api={api} onComplete={async () => {
      setAuth((current) => current ? { ...current, owner: { ...current.owner, onboarded: true } } : current);
      await refresh();
    }} />;
  }

  const selectedMatch = matches.find((item) => item.matchId === selectedMatchId) ?? null;
  return (
    <main className="min-h-[100dvh] bg-[#0b0d0c] text-[#eef2ee] [font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      <div className="mx-auto min-h-[100dvh] max-w-[560px] pb-[calc(82px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        {notice ? <button onClick={() => setNotice(null)} className="fixed bottom-[calc(82px+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-32px)] max-w-[528px] -translate-x-1/2 rounded-2xl bg-[#e8eee9] px-4 py-3 text-left text-sm font-medium text-[#161b18] shadow-2xl">{notice}</button> : null}
        <div className="px-5 pb-8">
          {refreshing ? <div className="mb-3 h-0.5 overflow-hidden bg-white/5"><div className="h-full w-1/3 animate-pulse bg-[#d9ff7a]"/></div> : null}
          {tab === "today" ? <Today matches={matches} chats={chats} settings={settings} freshnessState={freshnessState} openMatch={openMatch} openChat={openChat} openYou={() => openTab("you")} botUsername={auth.botUsername} /> : null}
          {tab === "matches" ? selectedMatch ? <MatchDetail match={selectedMatch} pending={pending} onBack={closeDetail} onAction={matchAction} onChat={openChat} onCall={async () => {
            setPending("call"); try { await api(`/api/telegram/call/${selectedMatch.matchId}`, { method: "POST", body: JSON.stringify({ action: "request_call" }) }); await refresh(true); setNotice("Call request sent."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not request a call"); } finally { setPending(null); }
          }} /> : <Matches matches={matches} openMatch={openMatch} /> : null}
          {tab === "chats" ? selectedChatId ? <ChatView chat={chat} ownerId={auth.owner.id} message={message} pending={pending} onBack={closeDetail} onMessage={(value) => { setMessage(value); localStorage.setItem(`beajee-chat-draft:${selectedChatId}`, value); if (value) telegramHost()?.enableClosingConfirmation?.(); else telegramHost()?.disableClosingConfirmation?.(); }} onSubmit={sendMessage} onAction={chatAction} chatEndRef={chatEndRef} /> : <Chats chats={chats} onOpen={openChat} /> : null}
          {tab === "you" && settings ? <You key={`${settings.networkingGoal}:${settings.schedulingUrl}:${settings.excludedTopics.join("|")}`} settings={settings} pending={pending} onUpdate={updateSettings} /> : null}
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[560px] border-t border-white/[0.07] bg-[#0b0d0c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          <div className="grid h-[70px] grid-cols-4">
            {(["today", "matches", "chats", "you"] as Tab[]).map((item) => {
              const badge = item === "today" ? matches.filter((m) => m.status === "PROPOSED" && !m.confirmedByMe).length : item === "chats" ? chats.reduce((sum, chatItem) => sum + chatItem.unreadCount, 0) : 0;
              return <button key={item} onClick={() => openTab(item)} className={`relative grid place-items-center gap-0.5 text-[10px] font-medium capitalize transition-colors ${tab === item ? "text-[#d9ff7a]" : "text-[#748078]"}`}><span className="relative"><Icon name={item}/>{badge > 0 ? <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-[#d9ff7a] px-1 text-center text-[9px] leading-4 text-[#101410]">{Math.min(9, badge)}</span> : null}</span>{item}</button>;
            })}
          </div>
        </nav>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#0b0d0c] text-[#eef2ee]"><div className="text-center"><div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border border-white/10 border-t-[#d9ff7a]"/><p className="text-sm text-[#89938d]">Opening Beajee…</p></div></main>;
}

function AuthRecovery({ error }: { error: string | null }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#0b0d0c] px-6 text-[#eef2ee]"><div className="max-w-sm"><p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#d9ff7a]">Beajee Web App</p><h1 className="text-3xl font-semibold tracking-tight">One small connection step.</h1><p className="mt-4 text-sm leading-6 text-[#89938d]">{error ?? "Open this page from the Beajee bot, or sign in in your browser."}</p><a href="/login" className="mt-7 block h-12 rounded-xl bg-[#d9ff7a] px-4 text-center text-sm font-semibold leading-[48px] text-[#101410]">Sign in to Beajee</a></div></main>;
}

function Today({ matches, chats, settings, freshnessState, openMatch, openChat, openYou, botUsername }: { matches: MatchItem[]; chats: ChatSummary[]; settings: Settings | null; freshnessState: string | null; openMatch: (id: string) => void; openChat: (id: string) => void; openYou: () => void; botUsername?: string | null }) {
  const proposed = matches.filter((match) => match.status === "PROPOSED" && !match.confirmedByMe);
  const waiting = matches.filter((match) => match.status === "PROPOSED" && match.confirmedByMe && !match.confirmedByOther);
  const unread = chats.filter((chat) => chat.unreadCount > 0);
  const callActions = matches.filter((match) => match.status === "MATCHED" && match.call && (match.call.wantsCallByOther || match.call.zoomUrl));
  const actionCount = proposed.length + unread.length + callActions.length + (settings?.pendingCheckIn ? 1 : 0) + (["AGING", "STALE", "INACTIVE"].includes(freshnessState ?? "") ? 1 : 0);
  return <section><SectionTitle eyebrow={actionCount ? `${actionCount} ${actionCount === 1 ? "thing" : "things"} for you` : "Your agent is working"}>{actionCount ? "Today" : "Nothing needs you right now."}</SectionTitle>
    <div className="space-y-2">
      {proposed.map((match) => <ActionRow key={match.matchId} label="New introduction" title={`Review ${personLabel(match)}`} body={match.framingForMe} onClick={() => openMatch(match.matchId)} />)}
      {waiting.map((match) => <ActionRow key={match.matchId} label="Waiting" title={`${personLabel(match)} hasn’t answered yet`} body="Your answer is saved. We’ll let you know when they decide." onClick={() => openMatch(match.matchId)} quiet />)}
      {unread.map((chat) => <ActionRow key={chat.chatId} label={`${chat.unreadCount} unread`} title={personLabel(chat)} body={chat.lastMessage?.content ?? "Open your conversation"} onClick={() => openChat(chat.matchId)} />)}
      {callActions.map((match) => <ActionRow key={`call-${match.matchId}`} label="Call" title={match.call?.zoomUrl ? `Join ${personLabel(match)}` : `${personLabel(match)} wants to talk`} body={match.call?.zoomUrl ? "Your Zoom room is ready." : "Open the match to respond."} onClick={() => openMatch(match.matchId)} />)}
      {settings?.pendingCheckIn ? <ActionRow label="About 2 minutes" title="Refresh your context" body="A short check-in helps your agent make more specific introductions." onClick={() => { if (botUsername) window.location.href = `https://t.me/${botUsername}`; }} /> : null}
      {["AGING", "STALE", "INACTIVE"].includes(freshnessState ?? "") ? <ActionRow label="Context needs attention" title="Help your agent stay current" body="Review your connection and current networking goal." onClick={openYou} /> : null}
    </div>
    {!actionCount ? <div className="mt-12 border-t border-white/[0.07] pt-6"><p className="text-sm text-[#89938d]">Current goal</p><p className="mt-2 text-lg font-medium text-[#eef2ee]">{GOALS.find(([key]) => key === settings?.networkingGoal)?.[1] ?? "Choose what you want from your network"}</p><button onClick={openYou} className="mt-5 text-sm font-medium text-[#d9ff7a]">Review agent settings →</button></div> : null}
  </section>;
}

function ActionRow({ label, title, body, onClick, quiet = false }: { label: string; title: string; body: string; onClick?: () => void; quiet?: boolean }) {
  return <button type="button" onClick={onClick} className={`w-full border-b border-white/[0.07] py-5 text-left active:opacity-70 ${quiet ? "opacity-70" : ""}`}><div className="flex items-start justify-between gap-5"><div><p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#93a097]">{label}</p><h2 className="text-[17px] font-semibold text-[#f0f3f0]">{title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#89938d]">{body}</p></div>{onClick ? <span className="mt-5 text-xl text-[#d9ff7a]">›</span> : null}</div></button>;
}

function Matches({ matches, openMatch }: { matches: MatchItem[]; openMatch: (id: string) => void }) {
  const [filter, setFilter] = useState<"active" | "dormant">("active");
  const visible = matches.filter((match) => filter === "dormant" ? match.status === "DORMANT" : match.status !== "DORMANT");
  return <section><SectionTitle eyebrow="People your agents agreed on">Matches</SectionTitle><div className="mb-5 flex gap-5 border-b border-white/[0.07]"><Filter active={filter === "active"} onClick={() => setFilter("active")}>Active</Filter><Filter active={filter === "dormant"} onClick={() => setFilter("dormant")}>Not now</Filter></div>{visible.length ? visible.map((match) => <button key={match.matchId} onClick={() => openMatch(match.matchId)} className="flex w-full items-center gap-4 border-b border-white/[0.07] py-5 text-left"><Avatar name={match.otherPerson.name} image={match.otherPerson.image}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="truncate font-semibold">{personLabel(match)}</h2><span className="text-[11px] text-[#7f8a83]">{match.status === "MATCHED" ? "Connected" : match.confirmedByMe ? "Waiting" : "Review"}</span></div><p className="mt-1 line-clamp-2 text-sm leading-5 text-[#89938d]">{match.framingForMe}</p></div></button>) : <Empty title={filter === "dormant" ? "Nothing in Not now" : "Your agent is searching"} body="Strong matches appear here only after both agents find a specific reason to introduce you."/>}</section>;
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`relative pb-3 text-sm font-medium ${active ? "text-[#eef2ee] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#d9ff7a]" : "text-[#758078]"}`}>{children}</button>;
}

function MatchDetail({ match, pending, onBack, onAction, onChat, onCall }: { match: MatchItem; pending: string | null; onBack: () => void; onAction: (id: string, action: "confirm" | "dormant") => void; onChat: (id: string) => void; onCall: () => void }) {
  return <section><button onClick={onBack} className="mb-6 text-sm text-[#9aa49e]">← Matches</button><div className="flex items-center gap-4"><Avatar name={match.otherPerson.name} image={match.otherPerson.image} size="lg"/><div><p className="text-[11px] uppercase tracking-[0.16em] text-[#8c9890]">{match.status === "MATCHED" ? "You’re connected" : match.confirmedByMe ? "Waiting for their answer" : "Your agent recommends"}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{personLabel(match)}</h1>{match.otherPerson.profession || match.otherPerson.location ? <p className="mt-1 text-sm text-[#89938d]">{[match.otherPerson.profession, match.otherPerson.location].filter(Boolean).join(" · ")}</p> : null}</div></div><div className="mt-9"><p className="text-[11px] uppercase tracking-[0.16em] text-[#d9ff7a]">Why now</p><p className="mt-3 text-lg leading-7 text-[#e8ede9]">{match.framingForMe}</p></div>{match.otherPerson.currentWork ? <div className="mt-8 border-t border-white/[0.07] pt-6"><p className="text-xs text-[#829087]">Currently working on</p><p className="mt-2 text-sm leading-6 text-[#c6cec8]">{match.otherPerson.currentWork}</p></div> : null}<details className="mt-6 border-y border-white/[0.07] py-5"><summary className="cursor-pointer text-sm font-medium text-[#aab4ad]">How the agents decided</summary><p className="mt-4 text-sm leading-6 text-[#7f8a83]">{match.overlapSummary}</p><p className="mt-4 text-xs leading-5 text-[#667069]">Only privacy-filtered published context was used. Neither agent saw the other person’s raw memory.</p></details>{match.status === "PROPOSED" && !match.confirmedByMe ? <div className="mt-8 grid grid-cols-[1fr_auto] gap-3"><button disabled={!!pending} onClick={() => onAction(match.matchId, "confirm")} className="h-[52px] rounded-xl bg-[#d9ff7a] px-5 text-sm font-semibold text-[#101410] disabled:opacity-50">{pending ? "Saving…" : "Meet"}</button><button disabled={!!pending} onClick={() => onAction(match.matchId, "dormant")} className="h-[52px] rounded-xl px-4 text-sm font-medium text-[#a4aea7] ring-1 ring-inset ring-white/10">Not now</button></div> : null}{match.status === "PROPOSED" && match.confirmedByMe ? <div className="mt-8 rounded-2xl bg-[#151a17] p-5"><p className="font-medium">Your answer is saved.</p><p className="mt-2 text-sm leading-6 text-[#89938d]">Chat opens only if {personLabel(match)} also says yes.</p></div> : null}{match.status === "MATCHED" ? <div className="mt-8 space-y-3"><button onClick={() => onChat(match.matchId)} className="h-[52px] w-full rounded-xl bg-[#d9ff7a] px-5 text-sm font-semibold text-[#101410]">Open chat{match.unreadCount ? ` · ${match.unreadCount} new` : ""}</button>{match.partnerSchedulingUrl ? <a href={match.partnerSchedulingUrl} target="_blank" rel="noreferrer" className="block h-[52px] w-full rounded-xl text-center text-sm font-medium leading-[52px] text-[#e6ebe7] ring-1 ring-inset ring-white/10">Book with {match.schedulingHostName ?? personLabel(match)}</a> : <button disabled={pending === "call"} onClick={onCall} className="h-[52px] w-full rounded-xl text-sm font-medium text-[#e6ebe7] ring-1 ring-inset ring-white/10">{match.call?.wantsCallByMe ? "Call requested" : "Request a Zoom call"}</button>}{match.call?.zoomUrl ? <a href={match.call.zoomUrl} target="_blank" rel="noreferrer" className="block h-[52px] w-full rounded-xl bg-[#eef2ee] text-center text-sm font-semibold leading-[52px] text-[#101410]">Join Zoom</a> : null}</div> : null}</section>;
}

function Chats({ chats, onOpen }: { chats: ChatSummary[]; onOpen: (id: string) => void }) {
  return <section><SectionTitle eyebrow="Conversations after mutual yes">Chats</SectionTitle>{chats.length ? chats.map((chat) => <button key={chat.chatId} onClick={() => onOpen(chat.matchId)} className="flex w-full items-center gap-4 border-b border-white/[0.07] py-5 text-left"><Avatar name={chat.otherPerson.name} image={chat.otherPerson.image}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><h2 className="truncate font-semibold">{personLabel(chat)}</h2>{chat.unreadCount ? <span className="min-w-5 rounded-full bg-[#d9ff7a] px-1.5 text-center text-[10px] font-semibold leading-5 text-[#101410]">{chat.unreadCount}</span> : null}</div><p className="mt-1 truncate text-sm text-[#89938d]">{chat.lastMessage?.content ?? chat.overlapSummary}</p></div></button>) : <Empty title="No conversations yet" body="A chat opens only after both people confirm the introduction."/>}</section>;
}

function ChatView({ chat, ownerId, message, pending, onBack, onMessage, onSubmit, onAction, chatEndRef }: { chat: ChatDetail | null; ownerId: string; message: string; pending: string | null; onBack: () => void; onMessage: (value: string) => void; onSubmit: (event: FormEvent) => void; onAction: (action: "archive" | "block" | "report", reason?: string) => void; chatEndRef: React.RefObject<HTMLDivElement> }) {
  const [showControls, setShowControls] = useState(false);
  const [reportReason, setReportReason] = useState("");
  if (!chat) return <div className="py-24 text-center text-sm text-[#89938d]">Opening conversation…</div>;
  return <section className="flex min-h-[calc(100dvh-130px)] flex-col"><div className="sticky top-0 z-20 -mx-5 flex items-center gap-3 border-b border-white/[0.07] bg-[#0b0d0c]/95 px-5 pb-4 pt-1 backdrop-blur"><button onClick={onBack} className="h-11 w-8 text-left text-xl text-[#9aa49e]">←</button><Avatar name={chat.otherPerson.name} image={chat.otherPerson.image} size="sm"/><div className="min-w-0 flex-1"><h1 className="truncate font-semibold">{personLabel(chat)}</h1><p className="truncate text-xs text-[#7f8a83]">{chat.otherPerson.currentWork ?? "Your new connection"}</p></div><button onClick={() => setShowControls((value) => !value)} className="h-11 w-10 text-xl text-[#89938d]" aria-label="Chat controls">···</button></div>{showControls ? <div className="border-b border-white/[0.07] bg-[#111512] py-4"><div className="grid grid-cols-2 gap-2"><button disabled={!!pending} onClick={() => onAction("archive")} className="h-11 rounded-xl bg-[#1a201c] text-sm text-[#bdc6bf]">Archive chat</button><button disabled={!!pending} onClick={() => { if (window.confirm(`Block ${personLabel(chat)}? They won’t be notified.`)) onAction("block"); }} className="h-11 rounded-xl bg-red-950/30 text-sm text-red-200">Block user</button></div><textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} rows={2} placeholder="Describe a safety or relevance issue" className="mt-2 w-full rounded-xl bg-[#1a201c] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-white/10"/><button disabled={reportReason.trim().length < 12 || !!pending} onClick={() => { onAction("report", reportReason.trim()); setReportReason(""); }} className="mt-2 h-11 w-full rounded-xl text-sm text-[#bdc6bf] ring-1 ring-inset ring-white/10 disabled:opacity-30">Submit report</button></div> : null}<div className="flex-1 space-y-3 py-6">{chat.messages.map((item) => { const mine = item.fromOwner === ownerId; const agent = item.kind === "AGENT_INTRO"; return <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? "rounded-br-md bg-[#d9ff7a] text-[#111511]" : agent ? "w-full max-w-none bg-[#141915] text-[#b8c1ba]" : "rounded-bl-md bg-[#1a201c] text-[#e1e6e2]"}`}>{agent ? <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[#849087]">Agent introduction</p> : null}<p className="whitespace-pre-wrap break-words">{item.content}</p></div></div>; })}<div ref={chatEndRef}/></div>{chat.status === "OPEN" ? <form onSubmit={onSubmit} className="sticky bottom-[calc(70px+env(safe-area-inset-bottom))] -mx-5 flex items-end gap-2 border-t border-white/[0.07] bg-[#0b0d0c]/95 px-5 py-3 backdrop-blur"><textarea value={message} onChange={(event) => onMessage(event.target.value)} rows={1} maxLength={5000} placeholder="Message" className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl bg-[#171c19] px-4 py-3 text-base text-[#eef2ee] outline-none ring-1 ring-inset ring-white/[0.08] placeholder:text-[#667069] focus:ring-[#d9ff7a]/40"/><button disabled={!message.trim() || pending === "send"} className="grid h-12 w-12 place-items-center rounded-full bg-[#d9ff7a] text-lg text-[#101410] disabled:opacity-30">↑</button></form> : <div className="sticky bottom-[calc(70px+env(safe-area-inset-bottom))] -mx-5 border-t border-white/[0.07] bg-[#111512] px-5 py-4 text-center text-sm text-[#89938d]">This chat is {chat.status.toLowerCase()}.</div>}</section>;
}

function You({ settings, pending, onUpdate }: { settings: Settings; pending: string | null; onUpdate: (body: Record<string, unknown>, success: string) => void }) {
  const [goal, setGoal] = useState(settings.networkingGoal ?? "peer");
  const [schedulingUrl, setSchedulingUrl] = useState(settings.schedulingUrl ?? "");
  const [topics, setTopics] = useState(settings.excludedTopics.join(", "));
  return <section><SectionTitle eyebrow="Your agent, your boundaries">You</SectionTitle><div className="flex items-center gap-4 border-b border-white/[0.07] pb-6"><Avatar name={settings.name} image={settings.image} size="lg"/><div><h2 className="text-xl font-semibold">{settings.name ?? "Your Beajee profile"}</h2><p className="mt-1 text-sm text-[#89938d]">{settings.agentId ? `${settings.agentPlatform ?? "Personal"} agent connected` : "Agent setup required"}</p></div></div><SettingBlock title="Networking goal" body="Changing this re-scores your context and retires old beacons."><select value={goal} onChange={(event) => setGoal(event.target.value)} className="h-12 w-full rounded-xl bg-[#171c19] px-3 text-base text-[#eef2ee] ring-1 ring-inset ring-white/10">{GOALS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Save disabled={pending === "settings" || goal === settings.networkingGoal} onClick={() => onUpdate({ networkingGoal: goal }, "Networking goal updated.")}/></SettingBlock><SettingBlock title="Match search" body="Pause new searches without losing active relationships."><button onClick={() => onUpdate({ agentActive: !settings.agentActive }, settings.agentActive ? "Search paused." : "Search resumed.")} disabled={pending === "settings"} className={`flex h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-medium ring-1 ring-inset ${settings.agentActive ? "bg-[#162019] text-[#d9ff7a] ring-[#d9ff7a]/20" : "bg-[#171c19] text-[#b3bdb6] ring-white/10"}`}><span>{settings.agentActive ? "Searching is on" : "Searching is paused"}</span><span className={`h-5 w-9 rounded-full p-0.5 ${settings.agentActive ? "bg-[#d9ff7a]" : "bg-[#39413c]"}`}><span className={`block h-4 w-4 rounded-full bg-[#101410] transition-transform ${settings.agentActive ? "translate-x-4" : ""}`}/></span></button></SettingBlock><SettingBlock title="Sensitive topics" body="These never enter search, negotiations, or generated advice."><textarea value={topics} onChange={(event) => setTopics(event.target.value)} rows={3} placeholder="health, family, politics" className="w-full rounded-xl bg-[#171c19] px-4 py-3 text-base leading-6 text-[#eef2ee] outline-none ring-1 ring-inset ring-white/10 placeholder:text-[#667069]"/><Save disabled={pending === "settings"} onClick={() => onUpdate({ excludedTopics: topics.split(",").map((topic) => topic.trim()).filter(Boolean) }, "Privacy exclusions updated.")}/></SettingBlock><SettingBlock title="Booking link" body="Cal.com or Calendly. Only your match receives it when they are assigned to book."><input type="url" value={schedulingUrl} onChange={(event) => setSchedulingUrl(event.target.value)} placeholder="https://cal.com/you/30min" className="h-12 w-full rounded-xl bg-[#171c19] px-4 text-base text-[#eef2ee] outline-none ring-1 ring-inset ring-white/10 placeholder:text-[#667069]"/><Save disabled={pending === "settings"} onClick={() => onUpdate({ schedulingUrl }, "Booking link updated.")}/></SettingBlock><div className="mt-8 border-t border-white/[0.07] pt-6"><p className="text-xs uppercase tracking-[0.15em] text-[#758078]">Context</p><p className="mt-2 text-sm text-[#c3cbc5]">{settings.contextPublished ? `Published · ${settings.freshnessState?.toLowerCase() ?? "active"}` : "Waiting for your agent’s first publish"}</p><p className="mt-2 text-xs leading-5 text-[#6f7a73]">Agents see only the privacy-filtered context snapshot, never your raw memory.</p></div></section>;
}

function SettingBlock({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return <div className="border-b border-white/[0.07] py-6"><h2 className="font-semibold">{title}</h2><p className="mb-4 mt-1 text-xs leading-5 text-[#7f8a83]">{body}</p><div className="space-y-3">{children}</div></div>;
}

function Save({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="h-11 w-full rounded-xl bg-[#e8eee9] text-sm font-semibold text-[#101410] disabled:opacity-30">Save</button>;
}

function Onboarding({ auth, api, onComplete }: { auth: AuthState; api: (path: string, init?: RequestInit) => Promise<{ setupPrompt?: string }>; onComplete: () => Promise<void> }) {
  const [goal, setGoal] = useState("peer");
  const [platform, setPlatform] = useState<AgentPlatform>("open_claw");
  const [countryCode, setCountryCode] = useState("US");
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupPrompt, setSetupPrompt] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const data = await api("/api/telegram/onboarding", { method: "POST", body: JSON.stringify({ agentPlatform: platform, networkingGoal: goal, countryCode, privacyConsent: privacy, researchConsent: false, excludedTopics: [] }) });
      if (!data.setupPrompt) throw new Error("Agent setup prompt was not generated");
      setSetupPrompt(data.setupPrompt); await onComplete(); telegramHost()?.HapticFeedback?.notificationOccurred?.("success");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not finish setup"); }
    finally { setBusy(false); }
  };
  if (setupPrompt) return <main className="min-h-[100dvh] bg-[#0b0d0c] px-6 pb-10 pt-[max(28px,env(safe-area-inset-top))] text-[#eef2ee]"><div className="mx-auto max-w-md"><p className="text-[11px] uppercase tracking-[0.18em] text-[#d9ff7a]">One last step</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Connect your personal agent.</h1><p className="mt-4 text-sm leading-6 text-[#89938d]">Copy this into {PLATFORM_LABELS[platform]}. Your credentials are already included.</p><pre className="mt-6 max-h-[45dvh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-[#151a17] p-4 text-xs leading-5 text-[#c6cec8] ring-1 ring-inset ring-white/[0.08]">{setupPrompt}</pre><button onClick={() => navigator.clipboard.writeText(setupPrompt)} className="mt-4 h-12 w-full rounded-xl bg-[#d9ff7a] text-sm font-semibold text-[#101410]">Copy setup prompt</button><button onClick={() => window.location.reload()} className="mt-3 h-12 w-full text-sm text-[#a6b0a9]">I’ll connect it later</button></div></main>;
  return <main className="min-h-[100dvh] bg-[#0b0d0c] px-6 pb-10 pt-[max(28px,env(safe-area-inset-top))] text-[#eef2ee]"><form onSubmit={submit} className="mx-auto max-w-md"><p className="text-[11px] uppercase tracking-[0.18em] text-[#d9ff7a]">Welcome{auth.owner.name ? `, ${auth.owner.name.split(" ")[0]}` : ""}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">What should your network do for you?</h1><p className="mt-3 text-sm leading-6 text-[#89938d]">Beajee’s agents negotiate privately and ask you only when both sides see concrete value.</p><div className="mt-8 space-y-2">{GOALS.map(([value, label]) => <label key={value} className={`flex min-h-14 items-center rounded-xl px-4 ring-1 ring-inset ${goal === value ? "bg-[#192119] text-[#eef2ee] ring-[#d9ff7a]/30" : "bg-[#131715] text-[#9aa49e] ring-white/[0.07]"}`}><input className="sr-only" type="radio" name="goal" value={value} checked={goal === value} onChange={() => setGoal(value)}/><span>{label}</span></label>)}</div><label className="mt-7 block text-xs font-medium uppercase tracking-[0.14em] text-[#78847c]">Personal agent<select value={platform} onChange={(event) => setPlatform(event.target.value as AgentPlatform)} className="mt-2 h-12 w-full rounded-xl bg-[#171c19] px-3 text-base normal-case tracking-normal text-[#eef2ee] ring-1 ring-inset ring-white/10">{PLATFORMS.map((value) => <option key={value} value={value}>{PLATFORM_LABELS[value]}</option>)}</select></label><label className="mt-5 block text-xs font-medium uppercase tracking-[0.14em] text-[#78847c]">Country<select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="mt-2 h-12 w-full rounded-xl bg-[#171c19] px-3 text-base normal-case tracking-normal text-[#eef2ee] ring-1 ring-inset ring-white/10">{countries.map((country) => <option key={country.code} value={country.code}>{country.flag} {country.name}</option>)}</select></label><label className="mt-7 flex items-start gap-3 text-sm leading-6 text-[#aab3ad]"><input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className="mt-1 h-5 w-5 accent-[#d9ff7a]"/><span>I consent to a privacy-filtered context snapshot being used for matching. Raw memory is never shared.</span></label>{error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}<button disabled={!privacy || busy} className="mt-7 h-[52px] w-full rounded-xl bg-[#d9ff7a] text-sm font-semibold text-[#101410] disabled:opacity-30">{busy ? "Creating your agent…" : "Create my Beajee agent"}</button></form></main>;
}
