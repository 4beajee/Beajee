"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { getCountryOptions } from "@/lib/countries";
import { ONBOARDING_AGENT_PLATFORMS, PLATFORM_LABELS } from "@/lib/agent-platform";
import { TELEGRAM_SUPPORT_URL, TELEGRAM_SUPPORT_USERNAME } from "@/lib/telegram/onboarding";
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
  safeAreaInset?: { top: number; right: number; bottom: number; left: number };
  contentSafeAreaInset?: { top: number; right: number; bottom: number; left: number };
  onEvent?: (event: "safeAreaChanged" | "contentSafeAreaChanged", fn: () => void) => void;
  offEvent?: (event: "safeAreaChanged" | "contentSafeAreaChanged", fn: () => void) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void };
  HapticFeedback?: { impactOccurred?: (style: "light" | "medium" | "heavy") => void; notificationOccurred?: (type: "success" | "warning" | "error") => void };
};

type AuthState = {
  token: string;
  owner: { id: string; name: string | null; onboarded: boolean; schedulingUrl: string | null };
  telegram?: { id: string; username: string | null } | null;
  botUsername?: string | null;
};

type SocialProfiles = {
  linkedin: { provider: "linkedin"; url: string; label: string } | null;
  twitter: { provider: "twitter"; url: string; label: string } | null;
};

type MatchItem = {
  matchId: string;
  status: "PROPOSED" | "MATCHED";
  overlapSummary: string;
  framingForMe: string;
  confirmedByMe: boolean;
  confirmedByOther: boolean;
  initiatedByMe: boolean;
  otherPerson: { id: string; name: string | null; image: string | null; currentWork: string | null; expertise: string[]; location: string | null; profession: string | null; socialProfiles: SocialProfiles };
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
  socialProfiles: SocialProfiles;
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

const PLATFORMS: AgentPlatform[] = [...ONBOARDING_AGENT_PLATFORMS];
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
    <img src={image} alt="" className={`${dimensions} shrink-0 rounded-full object-cover shadow-[0_16px_45px_rgba(0,0,0,0.6)]`} />
  ) : (
    <div className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-white font-semibold text-black shadow-[0_16px_45px_rgba(0,0,0,0.6)]`}>
      {initials(name)}
    </div>
  );
}

function Icon({ name }: { name: Tab }) {
  const path = {
    today: <><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></>,
    matches: <><path d="m12 3 2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 17.3l-5.6 2.94L7.47 14 2.94 9.58l6.26-.91L12 3z"/></>,
    chats: <><path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h8M8 14h5"/></>,
    you: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  }[name];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{path}</svg>;
}

function SectionTitle({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return <div className="mb-7">{eyebrow ? <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">{eyebrow}</p> : null}<h1 className="max-w-md text-[32px] font-semibold leading-[1.05] tracking-[-0.05em] text-white text-balance">{children}</h1></div>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="telegram-float mx-auto my-14 max-w-sm rounded-[36px] bg-white/[0.045] px-7 py-12 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl"><div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-full bg-white text-lg text-black">·</div><p className="text-base font-medium text-white">{title}</p><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">{body}</p></div>;
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
    const syncTelegramInsets = () => {
      const topInset = Math.max(tg?.safeAreaInset?.top ?? 0, tg?.contentSafeAreaInset?.top ?? 0);
      const bottomInset = Math.max(tg?.safeAreaInset?.bottom ?? 0, tg?.contentSafeAreaInset?.bottom ?? 0);
      document.documentElement.style.setProperty("--telegram-safe-top", `${topInset}px`);
      document.documentElement.style.setProperty("--telegram-safe-bottom", `${bottomInset}px`);
    };
    if (hostedByTelegram) {
      tg?.ready?.();
      tg?.expand?.();
      try { tg?.requestFullscreen?.(); } catch { /* Older clients stay expanded. */ }
      tg?.disableVerticalSwipes?.();
      syncTelegramInsets();
      tg?.onEvent?.("safeAreaChanged", syncTelegramInsets);
      tg?.onEvent?.("contentSafeAreaChanged", syncTelegramInsets);
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
    return () => {
      tg?.offEvent?.("safeAreaChanged", syncTelegramInsets);
      tg?.offEvent?.("contentSafeAreaChanged", syncTelegramInsets);
    };
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

  const matchAction = async (matchId: string) => {
    setPending(`confirm:${matchId}`); setNotice(null);
    try {
      await api("/api/telegram/matches", { method: "POST", body: JSON.stringify({ matchId, action: "confirm" }) });
      telegramHost()?.HapticFeedback?.notificationOccurred?.("success");
      await refresh(true);
      setNotice("Your answer is saved.");
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
    <main className="min-h-[100dvh] overflow-x-hidden bg-black text-white">
      <div className="telegram-app-shell mx-auto min-h-[100dvh] max-w-[560px] px-4 sm:px-6">
        {notice ? <button onClick={() => setNotice(null)} className="telegram-notice telegram-float fixed left-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 rounded-full bg-white px-5 py-3 text-left text-sm font-medium text-black shadow-[0_24px_80px_rgba(0,0,0,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">{notice}</button> : null}
        <header className="mb-10 flex items-center justify-between">
          <button onClick={() => openTab("today")} className="telegram-float grid h-12 w-12 place-items-center text-white transition-transform active:scale-95" aria-label="Open Today">
            {/* The app icon is the canonical Beajee mark; its black field disappears into the shell. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="h-12 w-12 object-contain" />
          </button>
          <div className="rounded-full bg-white/[0.06] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-neutral-400 backdrop-blur-2xl">Personal network</div>
          <button onClick={() => refresh()} disabled={refreshing} className="telegram-float-delayed grid h-12 w-12 place-items-center rounded-full bg-white/[0.09] text-lg text-white shadow-[0_18px_55px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-transform active:scale-95 disabled:opacity-40" aria-label="Refresh">↻</button>
        </header>
        <nav className="telegram-bottom-nav fixed left-1/2 z-40 grid w-[calc(100%-24px)] max-w-[536px] -translate-x-1/2 grid-cols-4 gap-1 rounded-full border border-white/[0.08] bg-black/80 p-1.5 shadow-[0_28px_80px_rgba(0,0,0,0.78)] backdrop-blur-2xl" aria-label="Main navigation">
          {(["today", "matches", "chats", "you"] as Tab[]).map((item) => {
            const badge = item === "today" ? matches.filter((m) => m.status === "PROPOSED" && !m.confirmedByMe).length : item === "chats" ? chats.reduce((sum, chatItem) => sum + chatItem.unreadCount, 0) : 0;
            return <button key={item} onClick={() => openTab(item)} aria-current={tab === item ? "page" : undefined} className={`relative flex min-h-12 items-center justify-center gap-2 rounded-full px-2 text-[11px] font-medium capitalize transition-[background-color,color,transform] active:scale-95 ${tab === item ? "bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)]" : "text-neutral-500 hover:bg-white/[0.06] hover:text-white"}`}><span className="relative"><Icon name={item}/>{badge > 0 ? <span className={`absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[9px] leading-4 ${tab === item ? "bg-black text-white" : "bg-white text-black"}`}>{Math.min(9, badge)}</span> : null}</span><span className="hidden min-[390px]:inline">{item}</span></button>;
          })}
        </nav>
        <div className="pb-8">
          {refreshing ? <div className="telegram-float mb-6 ml-auto w-fit rounded-full bg-white/[0.08] px-4 py-2 text-xs text-neutral-400 backdrop-blur-xl">Refreshing…</div> : null}
          {tab === "today" ? <Today matches={matches} chats={chats} settings={settings} freshnessState={freshnessState} openMatch={openMatch} openChat={openChat} openYou={() => openTab("you")} botUsername={auth.botUsername} /> : null}
          {tab === "matches" ? selectedMatch ? <MatchDetail match={selectedMatch} pending={pending} onBack={closeDetail} onAction={matchAction} onChat={openChat} onCall={async () => {
            setPending("call"); try { await api(`/api/telegram/call/${selectedMatch.matchId}`, { method: "POST", body: JSON.stringify({ action: "request_call" }) }); await refresh(true); setNotice("Call request sent."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not request a call"); } finally { setPending(null); }
          }} /> : <Matches matches={matches} openMatch={openMatch} /> : null}
          {tab === "chats" ? selectedChatId ? <ChatView chat={chat} ownerId={auth.owner.id} message={message} pending={pending} onBack={closeDetail} onMessage={(value) => { setMessage(value); localStorage.setItem(`beajee-chat-draft:${selectedChatId}`, value); if (value) telegramHost()?.enableClosingConfirmation?.(); else telegramHost()?.disableClosingConfirmation?.(); }} onSubmit={sendMessage} onAction={chatAction} chatEndRef={chatEndRef} /> : <Chats chats={chats} onOpen={openChat} /> : null}
          {tab === "you" && settings ? <You key={`${settings.networkingGoal}:${settings.schedulingUrl}:${settings.socialProfiles.linkedin?.url}:${settings.socialProfiles.twitter?.url}:${settings.excludedTopics.join("|")}`} settings={settings} pending={pending} onUpdate={updateSettings} /> : null}
        </div>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-[100dvh] place-items-center bg-black text-white"><div className="telegram-float rounded-[32px] bg-white/[0.06] px-10 py-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.7)] backdrop-blur-2xl"><div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border border-white/15 border-t-white"/><p className="text-sm text-neutral-500">Opening Beajee…</p></div></main>;
}

function AuthRecovery({ error }: { error: string | null }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-black px-6 text-white"><div className="telegram-float max-w-sm rounded-[40px] bg-white/[0.055] p-8 shadow-[0_35px_100px_rgba(0,0,0,0.75)] backdrop-blur-2xl"><div className="mb-8 grid h-14 w-14 place-items-center rounded-full bg-white font-bold text-black">B</div><p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500">Beajee Web App</p><h1 className="text-3xl font-semibold tracking-[-0.045em]">One small connection step.</h1><p className="mt-4 text-sm leading-6 text-neutral-500">{error ?? "Open this page from the Beajee bot, or sign in in your browser."}</p><a href="/login" className="mt-8 block h-14 rounded-full bg-white px-5 text-center text-sm font-semibold leading-[56px] text-black shadow-[0_18px_50px_rgba(0,0,0,0.45)] transition-transform active:scale-[0.98]">Sign in to Beajee</a></div></main>;
}

function Today({ matches, chats, settings, freshnessState, openMatch, openChat, openYou, botUsername }: { matches: MatchItem[]; chats: ChatSummary[]; settings: Settings | null; freshnessState: string | null; openMatch: (id: string) => void; openChat: (id: string) => void; openYou: () => void; botUsername?: string | null }) {
  const proposed = matches.filter((match) => match.status === "PROPOSED" && !match.confirmedByMe);
  const waiting = matches.filter((match) => match.status === "PROPOSED" && match.confirmedByMe && !match.confirmedByOther);
  const unread = chats.filter((chat) => chat.unreadCount > 0);
  const callActions = matches.filter((match) => match.status === "MATCHED" && match.call && (match.call.wantsCallByOther || match.call.zoomUrl));
  const actionCount = proposed.length + unread.length + callActions.length + (settings?.pendingCheckIn ? 1 : 0) + (["AGING", "STALE", "INACTIVE"].includes(freshnessState ?? "") ? 1 : 0);
  return <section><SectionTitle eyebrow={actionCount ? `${actionCount} ${actionCount === 1 ? "thing" : "things"} for you` : "Your agent is working"}>{actionCount ? "Today" : "Nothing needs you right now."}</SectionTitle>
    <div className="space-y-4">
      {proposed.map((match) => <ActionRow key={match.matchId} label="New introduction" title={`Review ${personLabel(match)}`} body={match.framingForMe} onClick={() => openMatch(match.matchId)} />)}
      {waiting.map((match) => <ActionRow key={match.matchId} label="Waiting" title={`${personLabel(match)} hasn’t answered yet`} body="Your answer is saved. We’ll let you know when they decide." onClick={() => openMatch(match.matchId)} quiet />)}
      {unread.map((chat) => <ActionRow key={chat.chatId} label={`${chat.unreadCount} unread`} title={personLabel(chat)} body={chat.lastMessage?.content ?? "Open your conversation"} onClick={() => openChat(chat.matchId)} />)}
      {callActions.map((match) => <ActionRow key={`call-${match.matchId}`} label="Call" title={match.call?.zoomUrl ? `Join ${personLabel(match)}` : `${personLabel(match)} wants to talk`} body={match.call?.zoomUrl ? "Your Zoom room is ready." : "Open the match to respond."} onClick={() => openMatch(match.matchId)} />)}
      {settings?.pendingCheckIn ? <ActionRow label="About 2 minutes" title="Refresh your context" body="A short check-in helps your agent make more specific introductions." onClick={() => { if (botUsername) window.location.href = `https://t.me/${botUsername}`; }} /> : null}
      {["AGING", "STALE", "INACTIVE"].includes(freshnessState ?? "") ? <ActionRow label="Context needs attention" title="Help your agent stay current" body="Review your connection and current networking goal." onClick={openYou} /> : null}
    </div>
    {!actionCount ? <div className="telegram-float-delayed mt-12 rounded-[32px] bg-white/[0.055] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"><p className="text-sm text-neutral-500">Current goal</p><p className="mt-2 text-lg font-medium text-white">{GOALS.find(([key]) => key === settings?.networkingGoal)?.[1] ?? "Choose what you want from your network"}</p><button onClick={openYou} className="mt-6 min-h-12 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-[0_14px_40px_rgba(0,0,0,0.4)] transition-transform active:scale-95">Review agent settings →</button></div> : null}
  </section>;
}

function ActionRow({ label, title, body, onClick, quiet = false }: { label: string; title: string; body: string; onClick?: () => void; quiet?: boolean }) {
  return <button type="button" onClick={onClick} className={`telegram-lift w-full rounded-[30px] bg-white/[0.055] p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-[transform,background-color,opacity] hover:bg-white/[0.08] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${quiet ? "opacity-60" : ""}`}><div className="flex items-center gap-4"><div className="min-w-0 flex-1"><p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">{label}</p><h2 className="text-[17px] font-semibold text-white">{title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">{body}</p></div>{onClick ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-xl text-black shadow-[0_12px_35px_rgba(0,0,0,0.45)]">›</span> : null}</div></button>;
}

function Matches({ matches, openMatch }: { matches: MatchItem[]; openMatch: (id: string) => void }) {
  return <section><SectionTitle eyebrow="People your agents agreed on">Matches</SectionTitle><div className="space-y-4">{matches.length ? matches.map((match) => <button key={match.matchId} onClick={() => openMatch(match.matchId)} className="telegram-lift flex w-full items-center gap-4 rounded-[30px] bg-white/[0.05] p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-[transform,background-color] hover:bg-white/[0.08] active:scale-[0.985]"><Avatar name={match.otherPerson.name} image={match.otherPerson.image}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="truncate font-semibold text-white">{personLabel(match)}</h2><span className="rounded-full bg-white/[0.08] px-3 py-1 text-[10px] text-neutral-400">{match.status === "MATCHED" ? "Connected" : match.confirmedByMe ? "Waiting" : "Review"}</span></div><p className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-500">{match.framingForMe}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black">›</span></button>) : <Empty title="Your agent is searching" body="Strong matches appear here only after both agents find a specific reason to introduce you."/>}</div></section>;
}

function MatchDetail({ match, pending, onBack, onAction, onChat, onCall }: { match: MatchItem; pending: string | null; onBack: () => void; onAction: (id: string) => void; onChat: (id: string) => void; onCall: () => void }) {
  return <section>
    <button onClick={onBack} className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-sm text-neutral-400 backdrop-blur-xl transition-transform active:scale-95">← Matches</button>
    <div className="telegram-float rounded-[38px] bg-white/[0.055] p-6 shadow-[0_32px_95px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
      <div className="flex items-center gap-4"><Avatar name={match.otherPerson.name} image={match.otherPerson.image} size="lg"/><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">{match.status === "MATCHED" ? "You’re connected" : match.confirmedByMe ? "Waiting for their answer" : "Your agent recommends"}</p><h1 className="mt-1 truncate text-3xl font-semibold tracking-[-0.045em] text-white">{personLabel(match)}</h1>{match.otherPerson.profession || match.otherPerson.location ? <p className="mt-1 text-sm text-neutral-500">{[match.otherPerson.profession, match.otherPerson.location].filter(Boolean).join(" · ")}</p> : null}</div></div>
      <div className="mt-9"><p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Why now</p><p className="mt-3 text-lg leading-7 text-white">{match.framingForMe}</p></div>
      {match.otherPerson.currentWork ? <div className="mt-8 rounded-[26px] bg-black/40 p-5"><p className="text-xs text-neutral-600">Currently working on</p><p className="mt-2 text-sm leading-6 text-neutral-300">{match.otherPerson.currentWork}</p></div> : null}
      {(match.otherPerson.socialProfiles.linkedin || match.otherPerson.socialProfiles.twitter) ? <div className="mt-5"><p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">Public profiles</p><div className="flex flex-wrap gap-2">{match.otherPerson.socialProfiles.linkedin ? <TelegramSocialBadge provider="linkedin" profile={match.otherPerson.socialProfiles.linkedin}/> : null}{match.otherPerson.socialProfiles.twitter ? <TelegramSocialBadge provider="twitter" profile={match.otherPerson.socialProfiles.twitter}/> : null}</div><p className="mt-3 text-xs leading-5 text-neutral-600">Shared by {personLabel(match)}. Beajee does not import or analyse these profiles.</p></div> : null}
      <details className="mt-4 rounded-[26px] bg-black/40 p-5"><summary className="cursor-pointer text-sm font-medium text-neutral-300">How the agents decided</summary><p className="mt-4 text-sm leading-6 text-neutral-500">{match.overlapSummary}</p><p className="mt-4 text-xs leading-5 text-neutral-600">Only privacy-filtered published context was used. Neither agent saw the other person’s raw memory.</p></details>
    </div>
    {match.status === "PROPOSED" && !match.confirmedByMe ? <div className="telegram-float-delayed mt-5 rounded-full bg-white/[0.055] p-2 shadow-[0_28px_80px_rgba(0,0,0,0.58)] backdrop-blur-2xl"><button disabled={!!pending} onClick={() => onAction(match.matchId)} className="h-14 w-full rounded-full bg-white px-6 text-sm font-semibold text-black transition-transform active:scale-[0.98] disabled:opacity-40">{pending ? "Saving…" : "Meet"}</button></div> : null}
    {match.status === "PROPOSED" && match.confirmedByMe ? <div className="telegram-float-delayed mt-5 rounded-[30px] bg-white/[0.055] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)]"><p className="font-medium text-white">Your answer is saved.</p><p className="mt-2 text-sm leading-6 text-neutral-500">Chat opens only if {personLabel(match)} also says yes.</p></div> : null}
    {match.status === "MATCHED" ? <div className="telegram-float-delayed mt-5 flex flex-wrap gap-3 rounded-[32px] bg-white/[0.055] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"><button onClick={() => onChat(match.matchId)} className="min-h-14 flex-1 rounded-full bg-white px-6 text-sm font-semibold text-black transition-transform active:scale-[0.98]">Open chat{match.unreadCount ? ` · ${match.unreadCount} new` : ""}</button>{match.partnerSchedulingUrl ? <a href={match.partnerSchedulingUrl} target="_blank" rel="noreferrer" className="min-h-14 flex-1 rounded-full bg-white/[0.08] px-6 text-center text-sm font-medium leading-[56px] text-white">Book with {match.schedulingHostName ?? personLabel(match)}</a> : <button disabled={pending === "call"} onClick={onCall} className="min-h-14 flex-1 rounded-full bg-white/[0.08] px-6 text-sm font-medium text-white">{match.call?.wantsCallByMe ? "Call requested" : "Request a Zoom call"}</button>}{match.call?.zoomUrl ? <a href={match.call.zoomUrl} target="_blank" rel="noreferrer" className="min-h-14 w-full rounded-full bg-white px-6 text-center text-sm font-semibold leading-[56px] text-black">Join Zoom</a> : null}</div> : null}
  </section>;
}

function TelegramSocialBadge({ provider, profile }: { provider: "linkedin" | "twitter"; profile: { url: string; label: string } }) {
  const linkedIn = provider === "linkedin";
  return <a href={profile.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold text-white shadow-[0_14px_38px_rgba(0,0,0,0.38)] transition-transform active:scale-95 ${linkedIn ? "border-transparent bg-[#0A66C2]" : "border-white/15 bg-black"}`} aria-label={`Open ${linkedIn ? "LinkedIn" : "Twitter / X"} profile ${profile.label}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${linkedIn ? "bg-white/15" : "border border-white/15 bg-black"}`}>{linkedIn ? <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="currentColor" aria-hidden="true"><path d="M6.5 8.25H3V21h3.5V8.25ZM4.75 3A2.05 2.05 0 1 0 4.75 7.1 2.05 2.05 0 0 0 4.75 3ZM21 13.7c0-3.84-2.05-5.63-4.78-5.63a4.12 4.12 0 0 0-3.72 2.05V8.25H9V21h3.5v-6.31c0-1.66.32-3.28 2.39-3.28 2.04 0 2.06 1.91 2.06 3.39V21H21v-7.3Z"/></svg> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>}</span>{profile.label}<span aria-hidden="true">↗</span></a>;
}

function Chats({ chats, onOpen }: { chats: ChatSummary[]; onOpen: (id: string) => void }) {
  return <section><SectionTitle eyebrow="Conversations after mutual yes">Chats</SectionTitle><div className="space-y-4">{chats.length ? chats.map((chat) => <button key={chat.chatId} onClick={() => onOpen(chat.matchId)} className="telegram-lift flex w-full items-center gap-4 rounded-[30px] bg-white/[0.05] p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-[transform,background-color] hover:bg-white/[0.08] active:scale-[0.985]"><Avatar name={chat.otherPerson.name} image={chat.otherPerson.image}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><h2 className="truncate font-semibold text-white">{personLabel(chat)}</h2>{chat.unreadCount ? <span className="min-w-6 rounded-full bg-white px-2 text-center text-[10px] font-semibold leading-6 text-black">{chat.unreadCount}</span> : null}</div><p className="mt-2 truncate text-sm text-neutral-500">{chat.lastMessage?.content ?? chat.overlapSummary}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white">›</span></button>) : <Empty title="No conversations yet" body="A chat opens only after both people confirm the introduction."/>}</div></section>;
}

function ChatView({ chat, ownerId, message, pending, onBack, onMessage, onSubmit, onAction, chatEndRef }: { chat: ChatDetail | null; ownerId: string; message: string; pending: string | null; onBack: () => void; onMessage: (value: string) => void; onSubmit: (event: FormEvent) => void; onAction: (action: "archive" | "block" | "report", reason?: string) => void; chatEndRef: React.RefObject<HTMLDivElement> }) {
  const [showControls, setShowControls] = useState(false);
  const [reportReason, setReportReason] = useState("");
  if (!chat) return <div className="telegram-float mx-auto my-24 w-fit rounded-full bg-white/[0.07] px-5 py-3 text-sm text-neutral-500">Opening conversation…</div>;
  return <section className="flex flex-col">
    <div className="telegram-float flex items-center gap-3 rounded-[30px] bg-white/[0.055] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.58)] backdrop-blur-2xl"><button onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.08] text-xl text-white">←</button><Avatar name={chat.otherPerson.name} image={chat.otherPerson.image} size="sm"/><div className="min-w-0 flex-1"><h1 className="truncate font-semibold text-white">{personLabel(chat)}</h1><p className="truncate text-xs text-neutral-500">{chat.otherPerson.currentWork ?? "Your new connection"}</p></div><button onClick={() => setShowControls((value) => !value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-lg text-black" aria-label="Chat controls">···</button></div>
    {showControls ? <div className="telegram-float-delayed mt-4 rounded-[30px] bg-white/[0.055] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"><div className="grid grid-cols-2 gap-2"><button disabled={!!pending} onClick={() => onAction("archive")} className="h-12 rounded-full bg-white/[0.08] text-sm text-neutral-300">Archive chat</button><button disabled={!!pending} onClick={() => { if (window.confirm(`Block ${personLabel(chat)}? They won’t be notified.`)) onAction("block"); }} className="h-12 rounded-full bg-white text-sm font-medium text-black">Block user</button></div><textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} rows={2} placeholder="Describe a safety or relevance issue" className="mt-3 w-full rounded-[24px] bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-700 focus:ring-2 focus:ring-white/20"/><button disabled={reportReason.trim().length < 12 || !!pending} onClick={() => { onAction("report", reportReason.trim()); setReportReason(""); }} className="mt-3 h-12 w-full rounded-full bg-white/[0.08] text-sm text-neutral-300 disabled:opacity-30">Submit report</button></div> : null}
    <div className="flex-1 space-y-4 py-8">{chat.messages.map((item) => { const mine = item.fromOwner === ownerId; const agent = item.kind === "AGENT_INTRO"; return <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[84%] rounded-[26px] px-5 py-3.5 text-sm leading-6 shadow-[0_18px_50px_rgba(0,0,0,0.38)] ${mine ? "bg-white text-black" : agent ? "w-full max-w-none bg-white/[0.055] text-neutral-300 backdrop-blur-xl" : "bg-white/[0.09] text-white backdrop-blur-xl"}`}>{agent ? <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-neutral-500">Agent introduction</p> : null}<p className="whitespace-pre-wrap break-words">{item.content}</p></div></div>; })}<div ref={chatEndRef}/></div>
    {chat.status === "OPEN" ? <form onSubmit={onSubmit} className="telegram-float-delayed flex items-end gap-2 rounded-[32px] bg-white/[0.07] p-2.5 shadow-[0_28px_85px_rgba(0,0,0,0.62)] backdrop-blur-2xl"><textarea value={message} onChange={(event) => onMessage(event.target.value)} rows={1} maxLength={5000} placeholder="Message" className="max-h-32 min-h-14 flex-1 resize-none rounded-[24px] bg-black/50 px-5 py-4 text-base text-white outline-none placeholder:text-neutral-700 focus:ring-2 focus:ring-white/20"/><button disabled={!message.trim() || pending === "send"} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-xl text-black shadow-[0_14px_40px_rgba(0,0,0,0.45)] transition-transform active:scale-95 disabled:opacity-30">↑</button></form> : <div className="rounded-full bg-white/[0.06] px-5 py-4 text-center text-sm text-neutral-500">This chat is {chat.status.toLowerCase()}.</div>}
  </section>;
}

function You({ settings, pending, onUpdate }: { settings: Settings; pending: string | null; onUpdate: (body: Record<string, unknown>, success: string) => void }) {
  const [goal, setGoal] = useState(settings.networkingGoal ?? "peer");
  const [schedulingUrl, setSchedulingUrl] = useState(settings.schedulingUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(settings.socialProfiles.linkedin?.url ?? "");
  const [twitterUrl, setTwitterUrl] = useState(settings.socialProfiles.twitter?.url ?? "");
  const [topics, setTopics] = useState(settings.excludedTopics.join(", "));
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") === "social-profiles") {
      requestAnimationFrame(() => document.getElementById("social-profiles")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, []);
  return <section><SectionTitle eyebrow="Your agent, your boundaries">You</SectionTitle><div className="telegram-float mb-5 flex items-center gap-4 rounded-[34px] bg-white/[0.055] p-5 shadow-[0_28px_85px_rgba(0,0,0,0.58)] backdrop-blur-2xl"><Avatar name={settings.name} image={settings.image} size="lg"/><div className="min-w-0"><h2 className="truncate text-xl font-semibold text-white">{settings.name ?? "Your Beajee profile"}</h2><p className="mt-1 text-sm text-neutral-500">{settings.agentId ? `${settings.agentPlatform ?? "Personal"} agent connected` : "Agent setup required"}</p></div></div><div className="space-y-5"><div id="social-profiles" className="scroll-mt-5"><SettingBlock title="Public profiles" body="Optional LinkedIn and Twitter/X links. They appear only after both agents agree on a match."><TelegramProfileInput provider="linkedin" label="LinkedIn" value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/you"/><TelegramProfileInput provider="twitter" label="Twitter / X" value={twitterUrl} onChange={setTwitterUrl} placeholder="https://x.com/you"/><Save disabled={pending === "settings"} onClick={() => onUpdate({ socialProfiles: { linkedin: linkedinUrl.trim() || null, twitter: twitterUrl.trim() || null } }, "Public profiles updated.")}/></SettingBlock></div><SettingBlock title="Networking goal" body="Changing this re-scores your context and retires old beacons."><select value={goal} onChange={(event) => setGoal(event.target.value)} className="h-14 w-full rounded-full bg-black/[0.55] px-5 text-base text-white outline-none focus:ring-2 focus:ring-white/20">{GOALS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Save disabled={pending === "settings" || goal === settings.networkingGoal} onClick={() => onUpdate({ networkingGoal: goal }, "Networking goal updated.")}/></SettingBlock><SettingBlock title="Match search" body="Pause new searches without losing active relationships."><button onClick={() => onUpdate({ agentActive: !settings.agentActive }, settings.agentActive ? "Search paused." : "Search resumed.")} disabled={pending === "settings"} className={`flex h-14 w-full items-center justify-between rounded-full px-5 text-sm font-medium transition-colors ${settings.agentActive ? "bg-white text-black" : "bg-black/[0.55] text-neutral-400"}`}><span>{settings.agentActive ? "Searching is on" : "Searching is paused"}</span><span className={`h-7 w-12 rounded-full p-1 ${settings.agentActive ? "bg-black" : "bg-white/10"}`}><span className={`block h-5 w-5 rounded-full ${settings.agentActive ? "translate-x-5 bg-white" : "bg-neutral-600"} transition-transform`}/></span></button></SettingBlock><SettingBlock title="Sensitive topics" body="These never enter search, negotiations, or generated advice."><textarea value={topics} onChange={(event) => setTopics(event.target.value)} rows={3} placeholder="health, family, politics" className="w-full rounded-[26px] bg-black/[0.55] px-5 py-4 text-base leading-6 text-white outline-none placeholder:text-neutral-700 focus:ring-2 focus:ring-white/20"/><Save disabled={pending === "settings"} onClick={() => onUpdate({ excludedTopics: topics.split(",").map((topic) => topic.trim()).filter(Boolean) }, "Privacy exclusions updated.")}/></SettingBlock><SettingBlock title="Booking link" body="Cal.com or Calendly. Only your match receives it when they are assigned to book."><input type="url" value={schedulingUrl} onChange={(event) => setSchedulingUrl(event.target.value)} placeholder="https://cal.com/you/30min" className="h-14 w-full rounded-full bg-black/[0.55] px-5 text-base text-white outline-none placeholder:text-neutral-700 focus:ring-2 focus:ring-white/20"/><Save disabled={pending === "settings"} onClick={() => onUpdate({ schedulingUrl }, "Booking link updated.")}/></SettingBlock><SettingBlock title="Technical help" body="Found a bug or something confusing? Contact the Beajee developer directly."><a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="flex h-14 w-full items-center justify-between rounded-full bg-white px-5 text-sm font-semibold text-black shadow-[0_14px_38px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98]"><span>Message @{TELEGRAM_SUPPORT_USERNAME}</span><span aria-hidden="true">↗</span></a></SettingBlock></div><div className="telegram-float-delayed mt-5 rounded-[30px] bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.5)]"><p className="text-xs uppercase tracking-[0.16em] text-neutral-600">Context</p><p className="mt-2 text-sm text-neutral-300">{settings.contextPublished ? `Published · ${settings.freshnessState?.toLowerCase() ?? "active"}` : "Waiting for your agent’s first publish"}</p><p className="mt-2 text-xs leading-5 text-neutral-600">Agents see only the privacy-filtered context snapshot, never your raw memory.</p></div></section>;
}

function TelegramProfileInput({ provider, label, value, onChange, placeholder }: { provider: "linkedin" | "twitter"; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const linkedIn = provider === "linkedin";
  return <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300"><span className={`grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold text-white ${linkedIn ? "bg-[#0A66C2]" : "bg-[#1D9BF0]"}`}>{linkedIn ? "in" : "𝕏"}</span>{label}</span><input type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="url" className="h-14 w-full rounded-full bg-black/[0.55] px-5 text-base text-white outline-none placeholder:text-neutral-700 focus:ring-2 focus:ring-white/20"/></label>;
}

function SettingBlock({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return <div className="telegram-lift rounded-[34px] bg-white/[0.055] p-6 shadow-[0_26px_75px_rgba(0,0,0,0.52)] backdrop-blur-2xl"><h2 className="font-semibold text-white">{title}</h2><p className="mb-5 mt-1 text-xs leading-5 text-neutral-500">{body}</p><div className="space-y-3">{children}</div></div>;
}

function Save({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="h-14 w-full rounded-full bg-white text-sm font-semibold text-black shadow-[0_14px_38px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98] disabled:opacity-25">Save</button>;
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
  if (setupPrompt) return <main className="min-h-[100dvh] bg-black px-5 pb-10 pt-[max(28px,env(safe-area-inset-top))] text-white"><div className="telegram-float mx-auto max-w-md rounded-[40px] bg-white/[0.055] p-7 shadow-[0_35px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl"><div className="mb-8 grid h-14 w-14 place-items-center rounded-full bg-white font-bold text-black">B</div><p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">One last step</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">Connect your personal agent.</h1><p className="mt-4 text-sm leading-6 text-neutral-500">Copy this into {PLATFORM_LABELS[platform]}. Your credentials are already included.</p><pre className="mt-7 max-h-[45dvh] overflow-auto whitespace-pre-wrap break-words rounded-[28px] bg-black/60 p-5 text-xs leading-5 text-neutral-300">{setupPrompt}</pre><button onClick={() => navigator.clipboard.writeText(setupPrompt)} className="mt-4 h-14 w-full rounded-full bg-white text-sm font-semibold text-black shadow-[0_16px_45px_rgba(0,0,0,0.42)] transition-transform active:scale-[0.98]">Copy setup prompt</button><button onClick={() => window.location.reload()} className="mt-3 h-14 w-full rounded-full text-sm text-neutral-500 hover:bg-white/[0.05] hover:text-white">I’ll connect it later</button></div></main>;
  return <main className="min-h-[100dvh] bg-black px-5 pb-10 pt-[max(28px,env(safe-area-inset-top))] text-white"><form onSubmit={submit} className="mx-auto max-w-md"><div className="telegram-float mb-7 grid h-14 w-14 place-items-center rounded-full bg-white font-bold text-black shadow-[0_18px_55px_rgba(0,0,0,0.7)]">B</div><p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Welcome{auth.owner.name ? `, ${auth.owner.name.split(" ")[0]}` : ""}</p><h1 className="mt-2 text-4xl font-semibold leading-[1.03] tracking-[-0.055em]">What should your network do for you?</h1><p className="mt-4 text-sm leading-6 text-neutral-500">Beajee’s agents negotiate privately and ask you only when both sides see concrete value.</p><div className="mt-8 grid gap-3">{GOALS.map(([value, label], index) => <label key={value} className={`telegram-lift flex min-h-16 items-center justify-between rounded-full px-6 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.48)] transition-[transform,background-color,color] active:scale-[0.985] ${goal === value ? "bg-white font-semibold text-black" : "bg-white/[0.055] text-neutral-400 backdrop-blur-xl"}`}><input className="sr-only" type="radio" name="goal" value={value} checked={goal === value} onChange={() => setGoal(value)}/><span>{label}</span><span className={`grid h-8 w-8 place-items-center rounded-full text-xs ${goal === value ? "bg-black text-white" : "bg-white/[0.08] text-neutral-500"}`}>{index + 1}</span></label>)}</div><div className="telegram-float-delayed mt-5 space-y-5 rounded-[36px] bg-white/[0.055] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.58)] backdrop-blur-2xl"><label className="block text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">Personal agent<select value={platform} onChange={(event) => setPlatform(event.target.value as AgentPlatform)} className="mt-3 h-14 w-full rounded-full bg-black/[0.55] px-5 text-base normal-case tracking-normal text-white outline-none focus:ring-2 focus:ring-white/20">{PLATFORMS.map((value) => <option key={value} value={value}>{PLATFORM_LABELS[value]}</option>)}</select></label><label className="block text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">Country<select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="mt-3 h-14 w-full rounded-full bg-black/[0.55] px-5 text-base normal-case tracking-normal text-white outline-none focus:ring-2 focus:ring-white/20">{countries.map((country) => <option key={country.code} value={country.code}>{country.flag} {country.name}</option>)}</select></label><label className="flex items-start gap-3 text-sm leading-6 text-neutral-400"><input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className="mt-1 h-5 w-5 accent-white"/><span>I consent to a privacy-filtered context snapshot being used for matching. Raw memory is never shared.</span></label>{error ? <p className="rounded-[22px] bg-white/[0.08] px-4 py-3 text-sm text-white">{error}</p> : null}</div><button disabled={!privacy || busy} className="telegram-float mt-5 h-16 w-full rounded-full bg-white text-sm font-semibold text-black shadow-[0_22px_65px_rgba(0,0,0,0.55)] transition-transform active:scale-[0.98] disabled:opacity-30">{busy ? "Creating your agent…" : "Create my Beajee agent"}</button></form></main>;
}
