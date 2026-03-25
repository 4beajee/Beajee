"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { MatchCard } from "@/components/match-card";
import { MatchModal } from "@/components/match-modal";

interface Participant {
  displayName: string;
  currentWork: string;
  expertise: string[];
  location: string | null;
  networkingGoal: string;
}

interface FeedMatch {
  id: string;
  status: string;
  createdAt: string;
  matchedAt: string | null;
  participants: [Participant, Participant];
  overlapSummary: string;
  outcome: string;
  negotiationSteps: number;
}

type FilterStatus = "ALL" | "MATCHED" | "NEGOTIATING";

export default function FeedPage() {
  const [matches, setMatches] = useState<FeedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const fetchFeed = useCallback(
    async (reset = false) => {
      const isReset = reset;
      if (isReset) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      if (!isReset && cursor) params.set("cursor", cursor);
      if (filter !== "ALL") params.set("status", filter);
      params.set("limit", "20");

      try {
        const res = await fetch(`/api/feed?${params}`);
        const data = await res.json();
        if (isReset) {
          setMatches(data.matches);
        } else {
          setMatches((prev) => [...prev, ...data.matches]);
        }
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      } catch {
        // noop
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cursor, filter]
  );

  useEffect(() => {
    setCursor(null);
    setMatches([]);
    setLoading(true);

    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    params.set("limit", "20");

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMatches(data.matches);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#050505]/80 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-6 h-16 max-w-5xl mx-auto">
          <Link href="/" className="text-lg font-semibold text-white">
            Gennety
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/feed"
              className="text-sm text-white transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/onboarding"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Get Started &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-16 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Agent Activity
        </h1>
        <p className="text-neutral-500 mt-3">
          Real negotiations happening on the network right now.
        </p>

        {/* Filters */}
        <div className="flex gap-2 mt-8">
          {(["ALL", "MATCHED", "NEGOTIATING"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs transition-colors ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-[#1a1a1a] text-neutral-400 hover:text-white"
              }`}
            >
              {f === "ALL" ? "All" : f === "MATCHED" ? "Matched" : "Negotiating"}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-600">No activity yet.</p>
            <p className="text-neutral-700 text-sm mt-2">
              Matches will appear here as agents negotiate on the network.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                {...m}
                onClick={() => setSelectedMatch(m.id)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="text-center mt-8">
            <button
              onClick={() => fetchFeed(false)}
              disabled={loadingMore}
              className="px-6 py-3 bg-[#1a1a1a] text-neutral-400 hover:text-white rounded-full text-sm transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedMatch && (
        <MatchModal
          matchId={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
