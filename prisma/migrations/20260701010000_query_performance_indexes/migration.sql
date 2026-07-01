-- B-tree indexes for the dominant liveness, context, beacon, match, and inbox filters.
CREATE INDEX "agents_is_active_search_paused_last_active_at_idx"
  ON "agents"("is_active", "search_paused", "last_active_at");

CREATE INDEX "agent_contexts_freshness_state_networking_goal_idx"
  ON "agent_contexts"("freshness_state", "networking_goal");

CREATE INDEX "beacons_agent_id_is_active_triggered_at_idx"
  ON "beacons"("agent_id", "is_active", "triggered_at");

CREATE INDEX "matches_agent_a_id_status_created_at_idx"
  ON "matches"("agent_a_id", "status", "created_at");

CREATE INDEX "matches_agent_b_id_status_created_at_idx"
  ON "matches"("agent_b_id", "status", "created_at");

CREATE INDEX "matches_status_is_public_matched_at_idx"
  ON "matches"("status", "is_public", "matched_at");

CREATE INDEX "inbox_events_agent_id_dismissed_at_created_at_idx"
  ON "inbox_events"("agent_id", "dismissed_at", "created_at");

-- Approximate nearest-neighbour indexes prevent full vector scans as the network grows.
CREATE INDEX "agent_contexts_embedding_hnsw_idx"
  ON "agent_contexts" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

CREATE INDEX "beacons_embedding_hnsw_idx"
  ON "beacons" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
