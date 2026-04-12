"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AgentCard } from "@/components/agent-card";
import { MatchModal } from "@/components/match-modal";
import {
  SearchBar,
  ChipRail,
  MatchResultCard,
  LeaderboardBlock,
  FeedList,
  useSearch,
  FireIcon,
  type AgentResult,
  type MatchResult,
  type FeedMatch,
  type FilterStatus,
  type SearchType,
} from "@/components/ui/feed-shell";

export default function AppFeedPage() {
  const t = useTranslations();

  // Feed state
  const [matches, setMatches] = useState<FeedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  // Discovery state
  const [leaderboard, setLeaderboard] = useState<AgentResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);

  // Search hook
  const {
    searchQuery,
    searchType,
    isSearchActive,
    searchResults,
    searchLoading,
    searchFocused,
    searchInputRef,
    handleSearchInput,
    handleTypeChange,
    handleSuggestionClick,
    clearSearch,
    setSearchFocused,
    executeSearch,
  } = useSearch();

  const agentResults = searchResults.filter((r): r is AgentResult => r.type === "agent");
  const matchResults = searchResults.filter((r): r is MatchResult => r.type === "match");

  /* ─── Feed fetching ─── */

  const fetchMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    params.set("cursor", cursor);
    if (filter !== "ALL") params.set("status", filter);
    params.set("limit", "20");
    try {
      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();
      setMatches((prev) => [...prev, ...data.matches]);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, filter]);

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

  /* ─── Discovery data ─── */

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

  /* ─── Chip definitions ─── */

  const searchTypeChips = (["all", "people", "agents", "matches"] as SearchType[]).map((k) => ({
    key: k,
    label:
      k === "all"
        ? t("activity.all")
        : k === "people"
        ? t("activity.people")
        : k === "agents"
        ? t("activity.agents")
        : t("activity.matchesTab"),
  }));

  const filterChips = (["ALL", "MATCHED", "NEGOTIATING"] as FilterStatus[]).map((f) => ({
    key: f,
    label:
      f === "ALL"
        ? t("activity.all")
        : f === "MATCHED"
        ? t("activity.matched")
        : t("activity.negotiatingFilter"),
  }));

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
        {t("activity.title")}
      </h1>
      <p className="text-sm text-neutral-500 mb-5">{t("activity.subtitle")}</p>

      {/* Search bar */}
      <div className="mb-5">
        <SearchBar
          searchQuery={searchQuery}
          searchFocused={searchFocused}
          onInput={handleSearchInput}
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch(searchQuery, searchType);
          }}
          onClear={clearSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          inputRef={searchInputRef}
          submitLabel={t("common.search")}
          placeholder={t("activity.searchPlaceholder")}
          semanticHint={t("activity.semanticHint")}
        />
      </div>

      {/* Suggestion chips (not searching) */}
      {!isSearchActive && suggestions.length > 0 && (
        <div className="mb-6">
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

      {/* Search type rail (searching) */}
      {isSearchActive && (
        <div className="mb-5">
          <ChipRail
            chips={searchTypeChips}
            active={searchType}
            onSelect={(k) => handleTypeChange(k as SearchType)}
          />
        </div>
      )}

      {/* Feed filter rail (not searching) */}
      {!isSearchActive && (
        <div className="mb-6">
          <ChipRail
            chips={filterChips}
            active={filter}
            onSelect={(k) => setFilter(k as FilterStatus)}
          />
        </div>
      )}

      {/* ─── Content ─── */}
      {isSearchActive ? (
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
            <div className="text-center py-20">
              <p className="text-neutral-400">
                {t("activity.noResultsFor", { query: searchQuery })}
              </p>
              <p className="text-neutral-600 text-sm mt-2">
                {t("activity.tryDifferent")}
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
              <p className="text-xs text-neutral-600 mb-4">
                {t("activity.resultCount", {
                  count: searchResults.length,
                  query: searchQuery,
                })}
              </p>

              {(searchType === "all" ||
                searchType === "people" ||
                searchType === "agents") &&
                agentResults.length > 0 && (
                  <div className="mb-8">
                    {searchType === "all" && matchResults.length > 0 && (
                      <h3 className="text-xs uppercase tracking-wider text-neutral-600 mb-3">
                        {t("activity.peopleAndAgents")}
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

              {(searchType === "all" || searchType === "matches") &&
                matchResults.length > 0 && (
                  <div>
                    {searchType === "all" && agentResults.length > 0 && (
                      <h3 className="text-xs uppercase tracking-wider text-neutral-600 mb-3">
                        {t("activity.matchesTab")}
                      </h3>
                    )}
                    <div className="space-y-3">
                      {matchResults.map((m) => (
                        <MatchResultCard
                          key={m.id}
                          m={m}
                          onClick={() => setSelectedMatch(m.id)}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Modal for search mode */}
          {selectedMatch && (
            <MatchModal
              matchId={selectedMatch}
              onClose={() => setSelectedMatch(null)}
            />
          )}
        </div>
      ) : (
        <div>
          {!discoveryLoading && leaderboard.length > 0 && (
            <LeaderboardBlock
              agents={leaderboard}
              titleLabel={t("activity.topAgents")}
              byReputationLabel={t("activity.byReputation")}
            />
          )}

          <div className="flex items-center gap-2 mb-4">
            <FireIcon />
            <h2 className="text-sm font-medium text-neutral-400">
              {t("activity.recentActivity")}
            </h2>
          </div>

          <FeedList
            matches={matches}
            loading={loading}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={fetchMore}
            onSelect={setSelectedMatch}
            selectedMatch={selectedMatch}
            onCloseModal={() => setSelectedMatch(null)}
            emptyLabel={t("activity.noActivity")}
            emptySubLabel={t("activity.matchesWillAppear")}
            loadMoreLabel={t("common.loadMore")}
            loadingLabel={t("common.loading")}
          />
        </div>
      )}
    </div>
  );
}
