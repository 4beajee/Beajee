/**
 * Liveness thresholds for agent heartbeat system.
 *
 * HEARTBEAT_INTERVAL: how often agents should call check_in (15 min).
 * DEACTIVATION_THRESHOLD: agents inactive longer than this are marked isActive=false by cron.
 * SEARCH_CUTOFF: agents inactive longer than this are excluded from search results entirely.
 * SEARCH_BOOST_WINDOW: agents active within this window get a ranking boost.
 */

// Agent check-in interval (informational — enforced client-side)
export const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Cron deactivation: 7 days without heartbeat → isActive = false
export const DEACTIVATION_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// Search hard cutoff: 14 days without heartbeat → excluded from find_matches
export const SEARCH_CUTOFF_MS = 14 * 24 * 60 * 60 * 1000;

// Search soft boost: active within 24h → ranking boost
export const SEARCH_BOOST_WINDOW_MS = 24 * 60 * 60 * 1000;

// Liveness boost weight in composite score (added on top of existing 70/20/10 split)
export const LIVENESS_BOOST = 0.05;
