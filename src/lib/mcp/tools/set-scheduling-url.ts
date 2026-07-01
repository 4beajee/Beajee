import { setOwnerSchedulingUrl } from "@/lib/services/owner-scheduling";
import { detectSchedulingProvider, schedulingProviderLabel } from "@/lib/scheduling-url";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const setSchedulingUrlTool = {
  name: "set_scheduling_url" as const,
  description:
    "Save the owner's Cal.com or Calendly booking link. Call during onboarding if the owner " +
    "has not added a link yet. This link is shared with matched partners so they can book one meeting.",
  inputSchema: {
    type: "object" as const,
    properties: {
      scheduling_url: {
        type: "string",
        description: "HTTPS Cal.com or Calendly booking URL",
      },
    },
    required: ["scheduling_url"],
  },
  handler: async (args: { scheduling_url: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const owner = await setOwnerSchedulingUrl({
      ownerId: authenticated.ownerId,
      schedulingUrl: args.scheduling_url,
    });
    const provider = owner.schedulingUrl
      ? detectSchedulingProvider(owner.schedulingUrl)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: true,
              scheduling_url: owner.schedulingUrl,
              provider,
              provider_label: provider ? schedulingProviderLabel(provider) : null,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
