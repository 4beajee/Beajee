"use client";

import { useEffect, useMemo, useState } from "react";
import { ScheduleCallButton } from "@/components/schedule-call-button";

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

interface AuthState {
  token: string;
  owner?: {
    id: string;
    name: string | null;
    onboarded: boolean;
    schedulingUrl: string | null;
  };
  telegram?: {
    id: string;
    username: string | null;
  };
}

interface TelegramMatch {
  matchId: string;
  status: string;
  framingForMe: string;
  otherOwnerName: string | null;
  schedulingRole: "guest" | "host" | null;
  partnerSchedulingUrl: string | null;
  partnerSchedulingProvider: string | null;
  schedulingHostName: string | null;
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[280px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {children}
    </section>
  );
}

export default function TelegramMiniAppPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<TelegramMatch[]>([]);

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
        setSchedulingUrl(data.owner?.schedulingUrl ?? "");
      })
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!auth?.token) return;

    fetch("/api/telegram/matches", {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load matches");
        setMatches(data.matches ?? []);
      })
      .catch(() => setMatches([]));
  }, [auth?.token]);

  const ownerLabel = useMemo(() => {
    if (loading) return "Connecting";
    if (auth?.owner) return auth.owner.name ?? auth.telegram?.username ?? "Telegram owner";
    return "Not connected";
  }, [auth, loading]);

  const saveSchedulingUrl = async () => {
    if (!auth?.token) return;
    setSaveMessage(null);

    const response = await fetch("/api/telegram/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ schedulingUrl }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSaveMessage(data.error ?? "Could not save scheduling link");
      return;
    }

    setAuth((current) =>
      current?.owner
        ? {
            ...current,
            owner: { ...current.owner, schedulingUrl: data.schedulingUrl },
          }
        : current
    );
    setSaveMessage("Saved");
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-4">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">Beajee</h1>
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

        <PanelShell>
          <div className="grid gap-3">
            <div>
              <h2 className="text-base font-semibold">Booking link</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Add your Cal.com or Calendly page. When you match, only the other person receives
                your link so one meeting gets booked.
              </p>
            </div>
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
              type="url"
              value={schedulingUrl}
              onChange={(e) => setSchedulingUrl(e.target.value)}
              placeholder="https://cal.com/you/30min"
            />
            <button
              type="button"
              onClick={saveSchedulingUrl}
              className="h-11 rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white"
            >
              Save booking link
            </button>
            {saveMessage && <p className="text-sm text-zinc-600">{saveMessage}</p>}
          </div>
        </PanelShell>

        <PanelShell>
          <div className="grid gap-4">
            <div>
              <h2 className="text-base font-semibold">Matches</h2>
              <p className="mt-1 text-sm text-zinc-600">
                When your agent finds a fit, you get the intro here. If you are the guest, book a
                time below.
              </p>
            </div>

            {matches.length === 0 ? (
              <p className="text-sm text-zinc-500">No active matches yet.</p>
            ) : (
              matches.map((match) => (
                <article key={match.matchId} className="rounded-xl border border-zinc-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{match.otherOwnerName ?? "New match"}</h3>
                    <span className="text-xs uppercase tracking-wide text-zinc-500">{match.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{match.framingForMe}</p>
                  {match.schedulingRole === "guest" && match.partnerSchedulingUrl ? (
                    <div className="mt-3">
                      <ScheduleCallButton
                        url={match.partnerSchedulingUrl}
                        providerLabel={match.partnerSchedulingProvider}
                        hostName={match.schedulingHostName}
                        variant="inline"
                      />
                    </div>
                  ) : null}
                  {match.schedulingRole === "host" ? (
                    <p className="mt-3 text-xs text-zinc-500">
                      Your booking link was shared with {match.otherOwnerName ?? "your match"}.
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </PanelShell>
      </div>
    </main>
  );
}