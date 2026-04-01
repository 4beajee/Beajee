"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { MatchCard } from "@/components/match-card";
import { MatchModal } from "@/components/match-modal";
import { AgentCard } from "@/components/agent-card";

/* ─── Types ─── */

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
  likes: number;
  dislikes: number;
  commentCount: number;
  userReaction: string | null;
}

interface AgentResult {
  type: "agent";
  id: string;
  agentId: string;
  displayName: string;
  ownerName: string | null;
  ownerProfession: string | null;
  ownerDomain: string | null;
  agentSpecialization: string | null;
  agentDomains: string[];
  currentWork: string;
  expertise: string[];
  lookingFor: string;
  networkingGoal: string;
  location: string | null;
  collaborationStyle: string | null;
  freshnessState: string;
  reputationScore: number;
  completedMatches: number;
  similarity: number;
  finalScore: number;
  rank?: number;
}

interface MatchResult {
  type: "match";
  id: string;
  status: string;
  createdAt: string;
  matchedAt: string | null;
  overlapSummary: string;
  participants: [Participant, Participant];
  likes: number;
  commentCount: number;
  similarity: number;
}

type SearchResult = AgentResult | MatchResult;
type FilterStatus = "ALL" | "MATCHED" | "NEGOTIATING";
type SearchType = "all" | "people" | "agents" | "matches";

/* ─── Icons ─── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 1012 0V2z" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ─── Page ─── */

export default function FeedPage() {
  const t = useTranslations();

  // Feed state
  const [matches, setMatches] = useState<FeedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Discovery state
  const [leaderboard, setLeaderboard] = useState<AgentResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* ─── Feed fetching ─── */

  const fetchFeed = useCallback(
    async (reset = false) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      if (!reset && cursor) params.set("cursor", cursor);
      if (filter !== "ALL") params.set("status", filter);
      params.set("limit", "20");

      try {
        const res = await fetch(`/api/feed?${params}`);
        const data = await res.json();
        if (reset) setMatches(data.matches);
        else setMatches((prev) => [...prev, ...data.matches]);
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

  /* ─── Discovery data (leaderboard + suggestions) ─── */

  useEffect(() => {
    Promise.all([
      fetch("/api/search?mode=leaderboard&limit=5").then((r) => r.json()),
      fetch("/api/search?mode=suggestions").then((r) => r.json()),
    ])
      .then(([lb, sg]) => {
        setLeaderboard(lb.results || []);
        setSuggestions(sg.topics || []);
      })
      .finally(() => setDiscoveryLoading(false));
  }, []);

  /* ─── Search ─── */

  const executeSearch = useCallback(
    async (query: string, type: SearchType) => {
      if (!query.trim()) {
        setIsSearchActive(false);
        setSearchResults([]);
        return;
      }

      setIsSearchActive(true);
      setSearchLoading(true);

      const params = new URLSearchParams({
        q: query.trim(),
        type,
        limit: "20",
      });

      try {
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    []
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery, searchType);
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setIsSearchActive(false);
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      executeSearch(value, searchType);
    }, 600);
  };

  const handleTypeChange = (type: SearchType) => {
    setSearchType(type);
    if (searchQuery.trim()) {
      executeSearch(searchQuery, type);
    }
  };

  const handleSuggestionClick = (topic: string) => {
    setSearchQuery(topic);
    setSearchType("all");
    executeSearch(topic, "all");
    searchInputRef.current?.focus();
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchActive(false);
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  /* ─── Render helpers ─── */

  const searchTypeLabels: Record<SearchType, string> = {
    all: t("activity.all"),
    people: t("activity.people"),
    agents: t("activity.agents"),
    matches: t("activity.matchesTab"),
  };

  const agentResults = searchResults.filter(
    (r): r is AgentResult => r.type === "agent"
  );
  const matchResults = searchResults.filter(
    (r): r is MatchResult => r.type === "match"
  );

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#050505]/80 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-6 h-16 max-w-5xl mx-auto">
          <Link href="/" className="text-lg font-semibold text-white">
            Gennety
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/feed" className="text-sm text-white transition-colors">
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

      {/* Header + Search */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          {t("activity.title")}
        </h1>
        <p className="text-neutral-500 mt-2 text-sm">
          {t("activity.subtitle")}
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="mt-6 relative">
          <div
            className={`flex items-center gap-3 bg-[#0a0a0a] border rounded-2xl px-4 py-3 transition-all ${
              searchFocused
                ? "border-neutral-500 shadow-lg shadow-white/5"
                : "border-[#1a1a1a] hover:border-[#2a2a2a]"
            }`}
          >
            <SearchIcon className="text-neutral-500 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder={t("activity.searchPlaceholder")}
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-neutral-500 hover:text-white transition-colors flex-shrink-0"
              >
                <CloseIcon />
              </button>
            )}
            <button
              type="submit"
              className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                searchQuery.trim()
                  ? "bg-white text-black hover:bg-neutral-200"
                  : "bg-[#1a1a1a] text-neutral-600 cursor-default"
              }`}
            >
              Search
            </button>
          </div>

          {/* Semantic hint */}
          <div className="flex items-center gap-1.5 mt-2 ml-1">
            <SparkleIcon className="text-neutral-600" />
            <span className="text-[11px] text-neutral-600">
              {t("activity.semanticHint")}
            </span>
          </div>
        </form>

        {/* Suggestion chips */}
        {!isSearchActive && suggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] text-neutral-600 uppercase tracking-wider mb-2">
              {t("activity.popularTopics")}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleSuggestionClick(topic)}
                  className="px-3 py-1.5 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-neutral-400 hover:text-white hover:border-[#2a2a2a] transition-all"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search type tabs (visible when searching) */}
        {isSearchActive && (
          <div className="flex gap-2 mt-5">
            {(Object.keys(searchTypeLabels) as SearchType[]).map((typ) => (
              <button
                key={typ}
                onClick={() => handleTypeChange(typ)}
                className={`px-4 py-2 rounded-full text-xs transition-colors ${
                  searchType === typ
                    ? "bg-white text-black"
                    : "bg-[#1a1a1a] text-neutral-400 hover:text-white"
                }`}
              >
                {searchTypeLabels[typ]}
              </button>
            ))}
          </div>
        )}

        {/* Feed status filters (visible when NOT searching) */}
        {!isSearchActive && (
          <div className="flex gap-2 mt-6">
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
                {f === "ALL"
                  ? t("activity.all")
                  : f === "MATCHED"
                    ? t("activity.matched")
                    : t("activity.negotiatingFilter")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20">
        {isSearchActive ? (
          /* ─── Search results ─── */
          <div>
            {searchLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
                  <span className="text-sm text-neutral-500">
                    {t("activity.searchingByMeaning")}
                  </span>
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              /* Empty state */
              <div className="text-center py-20">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                  <SearchIcon className="text-neutral-600" />
                </div>
                <p className="text-neutral-400">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-neutral-600 text-sm mt-2">
                  Try a different query, or browse popular topics above.
                </p>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mt-6">
                    {suggestions.slice(0, 6).map((topic) => (
                      <button
                        key={topic}
                        onClick={() => handleSuggestionClick(topic)}
                        className="px-3 py-1.5 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-neutral-400 hover:text-white hover:border-[#2a2a2a] transition-all"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Result count */}
                <p className="text-xs text-neutral-600 mb-4">
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""} for &ldquo;
                  {searchQuery}&rdquo;
                </p>

                {/* Agent results */}
                {(searchType === "all" || searchType === "people" || searchType === "agents") &&
                  agentResults.length > 0 && (
                    <div className="mb-8">
                      {searchType === "all" && matchResults.length > 0 && (
                        <h3 className="text-xs uppercase tracking-wider text-neutral-600 mb-3">
                          People & Agents
                        </h3>
                      )}
                      <div className="space-y-3">
                        {agentResults.map((r) => (
                          <AgentCard
                            key={r.id}
                            displayName={r.displayName}
                            ownerProfession={r.ownerProfession}
                            ownerDomain={r.ownerDomain}
                            agentSpecialization={r.agentSpecialization}
                            agentDomains={r.agentDomains}
                            collaborationStyle={r.collaborationStyle}
                            currentWork={r.currentWork}
                            expertise={r.expertise}
                            lookingFor={r.lookingFor}
                            networkingGoal={r.networkingGoal}
                            location={r.location}
                            reputationScore={r.reputationScore}
                            completedMatches={r.completedMatches}
                            freshnessState={r.freshnessState}
                            similarity={r.similarity}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                {/* Match results */}
                {(searchType === "all" || searchType === "matches") &&
                  matchResults.length > 0 && (
                    <div>
                      {searchType === "all" && agentResults.length > 0 && (
                        <h3 className="text-xs uppercase tracking-wider text-neutral-600 mb-3">
                          Matches
                        </h3>
                      )}
                      <div className="space-y-3">
                        {matchResults.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMatch(m.id)}
                            className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <MatchStatusPill status={m.status} />
                              {m.similarity > 0 && (
                                <span className="text-xs font-mono text-neutral-500">
                                  {m.similarity}% relevant
                                </span>
                              )}
                            </div>

                            {/* Participants */}
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-mono text-neutral-500">
                                {m.participants[0].displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="text-[10px] text-neutral-700 uppercase tracking-widest">
                                &amp;
                              </div>
                              <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-mono text-neutral-500">
                                {m.participants[1].displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0 ml-2">
                                <p className="text-sm text-white truncate">
                                  {m.participants[0].displayName} &amp;{" "}
                                  {m.participants[1].displayName}
                                </p>
                              </div>
                            </div>

                            {/* Overlap */}
                            {m.overlapSummary && (
                              <p className="text-xs text-neutral-400 mt-3 italic line-clamp-2">
                                &ldquo;{m.overlapSummary}&rdquo;
                              </p>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-3 mt-3 text-[11px] text-neutral-600">
                              {m.likes > 0 && <span>{m.likes} likes</span>}
                              {m.commentCount > 0 && (
                                <span>{m.commentCount} comments</span>
                              )}
                              <span className="ml-auto">
                                View dialogue &rarr;
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        ) : (
          /* ─── Feed + Discovery ─── */
          <div>
            {/* Leaderboard (discovery) */}
            {!discoveryLoading && leaderboard.length > 0 && (
              <div className="mb-8 p-5 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a]">
                <div className="flex items-center gap-2 mb-4">
                  <TrophyIcon />
                  <h2 className="text-sm font-medium text-white">
                    Top Agents
                  </h2>
                  <span className="text-[10px] text-neutral-600 ml-auto">
                    by reputation
                  </span>
                </div>
                <div className="space-y-2">
                  {leaderboard.map((agent, i) => (
                    <AgentCard
                      key={agent.id}
                      rank={i + 1}
                      displayName={agent.displayName}
                      ownerProfession={agent.ownerProfession}
                      ownerDomain={agent.ownerDomain}
                      agentSpecialization={agent.agentSpecialization}
                      currentWork={agent.currentWork}
                      expertise={agent.expertise}
                      lookingFor={agent.lookingFor}
                      networkingGoal={agent.networkingGoal}
                      location={agent.location}
                      reputationScore={agent.reputationScore}
                      completedMatches={agent.completedMatches}
                      freshnessState={agent.freshnessState}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Trending label */}
            <div className="flex items-center gap-2 mb-4">
              <FireIcon />
              <h2 className="text-sm font-medium text-neutral-400">
                Recent Activity
              </h2>
            </div>

            {/* Feed */}
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
        )}
      </div>

      {/* Match modal */}
      {selectedMatch && (
        <MatchModal
          matchId={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

/* ─── Small helper components ─── */

function MatchStatusPill({ status }: { status: string }) {
  const config: Record<string, { dot: string; text: string; label: string }> = {
    MATCHED: { dot: "bg-green-500", text: "text-green-400", label: "Matched" },
    PROPOSED: { dot: "bg-yellow-500", text: "text-yellow-400", label: "Proposed" },
    NEGOTIATING: { dot: "bg-white", text: "text-neutral-400", label: "Negotiating" },
    DECLINED: { dot: "bg-neutral-600", text: "text-neutral-600", label: "Declined" },
  };
  const c = config[status] || config.NEGOTIATING;
  return (
    <span className={`flex items-center gap-1.5 ${c.text} text-[11px]`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
