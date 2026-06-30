import { requestZoomCall } from "@/lib/services/match-call";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const requestZoomCallTool = {
  name: "request_zoom_call" as const,
  description:
    "Signal that your owner wants a Zoom call with their match. When both owners want a call, " +
    "the platform provisions a real Zoom meeting when the Zoom provider is configured.",
  inputSchema: {
    type: "object" as const,
    properties: {
      match_id: {
        type: "string",
        description: "The matched introduction ID",
      },
    },
    required: ["match_id"],
  },
  handler: async (args: { match_id: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await requestZoomCall(args.match_id, authenticated.ownerId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
