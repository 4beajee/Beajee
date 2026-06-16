"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function TelegramMatchDialoguePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-50" />}>
      <TelegramMatchDialogueContent />
    </Suspense>
  );
}

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  BackButton?: {
    show: () => void;
    onClick: (cb: () => void) => void;
  };
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

interface AuthState {
  token: string;
}

interface DialogueEntry {
  role: string;
  displayName: string;
  type: string;
  content: string;
  createdAt: string;
}

interface DialogueState {
  matchId: string;
  status: string;
  overlapSummary: string;
  framingForMe: string | null;
  otherOwnerName: string | null;
  negotiationLog: DialogueEntry[];
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[200px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {children}
    </section>
  );
}

function TelegramMatchDialogueContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");
  const view = searchParams.get("view");

  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [dialogueError, setDialogueError] = useState<string | null>(null);

  useEffect(() => {
    const webApp = (window as TelegramWindow).Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    webApp?.BackButton?.show();
    webApp?.BackButton?.onClick(() => {
      window.history.back();
    });

    if (!matchId) {
      queueMicrotask(() => {
        setAuthError("Нет контекста матча — откройте заново из бота.");
        setLoading(false);
      });
      return;
    }

    const initData = webApp?.initData;
    if (!initData) {
      queueMicrotask(() => {
        setAuthError("Откройте эту страницу внутри Telegram.");
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
        setAuth({ token: data.token });
      })
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    if (!auth?.token || !matchId) return;

    fetch(`/api/telegram/matches/${encodeURIComponent(matchId)}/dialogue`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load dialogue");
        setDialogue(data);
      })
      .catch((error) => {
        setDialogueError(error instanceof Error ? error.message : String(error));
      });
  }, [auth?.token, matchId]);

  const title = useMemo(() => {
    if (view === "dialogue") return "Agent dialogue";
    return "Match";
  }, [view]);

  const subtitle = useMemo(() => {
    if (loading) return "Connecting…";
    if (dialogue?.otherOwnerName) return dialogue.otherOwnerName;
    return "Beajee";
  }, [dialogue, loading]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-4">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">{title}</h1>
            <p className="text-sm text-zinc-500">{subtitle}</p>
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

        {dialogueError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {dialogueError}
          </div>
        )}

        {dialogue && (
          <PanelShell>
            <div className="grid gap-4">
              {dialogue.framingForMe ? (
                <p className="text-sm leading-6 text-zinc-700">{dialogue.framingForMe}</p>
              ) : null}

              {dialogue.overlapSummary ? (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Why now
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-700">{dialogue.overlapSummary}</p>
                </div>
              ) : null}

              <div>
                <h2 className="text-base font-semibold">Negotiation</h2>
                {dialogue.negotiationLog.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">No agent dialogue recorded yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {dialogue.negotiationLog.map((entry, index) => (
                      <li
                        key={`${entry.createdAt}-${index}`}
                        className="rounded-xl border border-zinc-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                          <span className="font-medium text-zinc-700">{entry.displayName}</span>
                          <span>{entry.role}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                          {entry.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </PanelShell>
        )}
      </div>
    </main>
  );
}