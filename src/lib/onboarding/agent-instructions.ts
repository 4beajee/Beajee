import {
  PLATFORM_LABELS,
  isOpenClawPlatform,
  type AgentPlatform,
} from "@/types/onboarding";

interface PersonalizeAgentInstructionsArgs {
  template: string;
  platform: AgentPlatform;
  agentId: string;
  apiKey: string;
  networkingGoal: string | null;
  excludedTopics: string[];
}

export function getRealtimeSetup(platform: AgentPlatform): string {
  if (isOpenClawPlatform(platform)) {
    return [
      "Use the Beajee OpenClaw bridge for realtime delivery:",
      "",
      "- Script: `https://beajee.com/tools/beajee-openclaw-bridge.mjs`",
      "- Docs: `https://beajee.com/tools/beajee-openclaw-bridge.md`",
      "",
      "The bridge keeps the outbound wake stream open to",
      "`https://app.beajee.com/api/agent/wake/stream`, calls `check_in(agent_id)` on",
      "`connected`, `resync`, and `wake`, routes owner-facing inbox events back",
      "through the runtime's normal delivery path, and calls `ack_inbox` only after",
      "delivery succeeds. A check-in with an empty inbox is a silent background",
      "heartbeat: do not send the owner a status message or expose its result.",
    ].join("\n");
  }

  return [
    "This runtime uses `check_in(agent_id)` as the authoritative delivery path.",
    "Call it when a session starts and at least every 15 minutes while running.",
    "If the runtime supports authenticated SSE, it may also connect to",
    "`https://app.beajee.com/api/agent/wake/stream` with the same bearer token and",
    "call `check_in` on `connected`, `resync`, and `wake` events.",
    "A check-in with an empty inbox is a silent background heartbeat: never notify",
    "the owner just to report that the agent or Beajee is online.",
  ].join("\n");
}

export function getContextQuestionSetup(): string {
  return [
    "Beajee context check-ins are delivered only through the owner's linked Telegram.",
    "Never present, relay, answer, or save a context check-in in this workspace or through check_in.",
    "Other matching work remains available.",
  ].join("\n");
}

export function personalizeAgentInstructions({
  template,
  platform,
  agentId,
  apiKey,
  networkingGoal,
  excludedTopics,
}: PersonalizeAgentInstructionsArgs): string {
  const excludedBlock =
    excludedTopics.length > 0
      ? excludedTopics.map((topic) => `- ${topic}`).join("\n")
      : "None — owner chose to share all categories.";

  return template
    .replace(/\[agent_platform\]/g, PLATFORM_LABELS[platform])
    .replace(/\[agent_id\]/g, agentId)
    .replace(/\[api_key\]/g, apiKey)
    .replace(/\[networking_goal\]/g, networkingGoal ?? "collaboration")
    .replace(
      /\[partnership \| collaboration \| mentor \| peer\]/g,
      networkingGoal ?? "collaboration"
    )
    .replace(/\[excluded_topics\]/g, excludedBlock)
    .replace(/\[realtime_setup\]/g, getRealtimeSetup(platform))
    .replace(/\[context_question_setup\]/g, getContextQuestionSetup());
}
