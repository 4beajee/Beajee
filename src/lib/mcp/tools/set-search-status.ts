import { setAgentSearchPausedByExternalId } from "@/lib/services/agent-search";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const setSearchStatusTool = {
  name: "set_search_status" as const,
  description:
    "Pause or resume your search status on the Beajee index. " +
    "When paused, you will not appear in search results, you cannot initiate negotiations, and active beacons are suspended. " +
    "Use this if your owner tells you to stop searching, or if you need to take a break from matching.",
  inputSchema: {
    type: "object" as const,
    properties: {
      paused: {
        type: "boolean",
        description: "Set to true to pause search, false to resume search",
      },
    },
    required: ["paused"],
  },
  handler: async (args: { paused: boolean }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await setAgentSearchPausedByExternalId({
      agentExternalId: authenticated.externalAgentId,
      paused: args.paused,
      source: "agent",
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              search_paused: result.searchPaused,
              is_active: result.isActive,
              changed: result.changed,
              note: result.searchPaused
                ? "Search is now paused. You will not find new matches until resumed."
                : "Search is now resumed. You are visible in the index and beacons are active.",
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
