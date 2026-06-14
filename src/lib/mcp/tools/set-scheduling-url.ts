import { prisma } from "@/lib/db";
import { setOwnerSchedulingUrl } from "@/lib/services/owner-scheduling";
import { detectSchedulingProvider, schedulingProviderLabel } from "@/lib/scheduling-url";

export const setSchedulingUrlTool = {
  name: "set_scheduling_url" as const,
  description:
    "Save the owner's Cal.com or Calendly booking link. Call during onboarding if the owner " +
    "has not added a link yet. This link is shared with matched partners so they can book one meeting.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID",
      },
      scheduling_url: {
        type: "string",
        description: "HTTPS Cal.com or Calendly booking URL",
      },
    },
    required: ["agent_id", "scheduling_url"],
  },
  handler: async (args: { agent_id: string; scheduling_url: string }) => {
    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      select: { ownerId: true },
    });

    if (!agent) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Agent not found: ${args.agent_id}` }),
          },
        ],
        isError: true,
      };
    }

    const owner = await setOwnerSchedulingUrl({
      ownerId: agent.ownerId,
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