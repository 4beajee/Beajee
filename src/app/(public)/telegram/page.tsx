"use client";

import { useEffect, useMemo, useState } from "react";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

const tabs = [
  { id: "onboarding", label: "Onboarding" },
  { id: "matches", label: "Matches" },
  { id: "chat", label: "Agent Chat" },
  { id: "dialogue", label: "Dialogue" },
  { id: "team", label: "Team Space" },
  { id: "strategy", label: "Strategy" },
] as const;

type TabId = (typeof tabs)[number]["id"];

interface AuthState {
  owner?: {
    id: string;
    name: string | null;
    onboarded: boolean;
  };
  telegram?: {
    id: string;
    username: string | null;
  };
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <section className="min-h-[360px] rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">{children}</section>;
}

export default function TelegramMiniAppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("matches");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const webApp = (window as TelegramWindow).Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();

    const initData = webApp?.initData;
    if (!initData) {
      queueMicrotask(() => {
        setAuthError("Open this page inside Telegram to start a Mini App session.");
        setLoading(false);
      });
      return;
    }

    fetch("/api/telegram/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Telegram auth failed");
        setAuth(data);
      })
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setLoading(false));
  }, []);

  const ownerLabel = useMemo(() => {
    if (loading) return "Connecting";
    if (auth?.owner) return auth.owner.name ?? auth.telegram?.username ?? "Telegram owner";
    return "Not connected";
  }, [auth, loading]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-4">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">Gennety</h1>
            <p className="text-sm text-zinc-500">{ownerLabel}</p>
          </div>
          <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">
            Mini App
          </span>
        </header>

        {authError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {authError}
          </div>
        )}

        <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-10 rounded-md border px-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "onboarding" && (
          <PanelShell>
            <div className="grid gap-3">
              <input className="h-11 rounded-md border border-zinc-200 px-3" placeholder="Name" />
              <input className="h-11 rounded-md border border-zinc-200 px-3" placeholder="Professional domain" />
              <select className="h-11 rounded-md border border-zinc-200 px-3">
                <option>Find a collaborator</option>
                <option>Find a business partner</option>
                <option>Find a mentor</option>
                <option>Find a peer</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" />
                Allow agent context for networking
              </label>
            </div>
          </PanelShell>
        )}

        {activeTab === "matches" && (
          <PanelShell>
            <div className="grid gap-3">
              <article className="rounded-md border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">No active match cards</h2>
                  <span className="text-xs text-zinc-500">Live</span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Match Cards sent by agents will appear here with Start Chat, Agent Dialogue, Schedule Call, and Skip actions.
                </p>
              </article>
            </div>
          </PanelShell>
        )}

        {activeTab === "chat" && (
          <PanelShell>
            <div className="flex h-full min-h-[300px] flex-col gap-3">
              <div className="flex-1 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
                Agent messages will sync here.
              </div>
              <div className="flex gap-2">
                <input className="h-11 flex-1 rounded-md border border-zinc-200 px-3" placeholder="Message your agent" />
                <button className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Send</button>
              </div>
            </div>
          </PanelShell>
        )}

        {activeTab === "dialogue" && (
          <PanelShell>
            <ol className="grid gap-3 text-sm">
              <li className="rounded-md border border-zinc-200 p-3">Agent negotiation transcripts will appear after a proposal.</li>
              <li className="rounded-md border border-zinc-200 p-3">Each step is sourced from NegotiationLog.</li>
            </ol>
          </PanelShell>
        )}

        {activeTab === "team" && (
          <PanelShell>
            <div className="grid gap-3">
              <input className="h-11 rounded-md border border-zinc-200 px-3" placeholder="Search Context Hub" />
              <div className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-600">
                Team tasks and activity alerts route through the Team Space Telegram topic when team mode is enabled.
              </div>
            </div>
          </PanelShell>
        )}

        {activeTab === "strategy" && (
          <PanelShell>
            <div className="rounded-md border border-zinc-200 p-3">
              <h2 className="text-base font-semibold">Strategy Summary</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Weekly strategy reports will show judge findings, accepted claims, counter-evidence, and next actions.
              </p>
            </div>
          </PanelShell>
        )}
      </div>
    </main>
  );
}
