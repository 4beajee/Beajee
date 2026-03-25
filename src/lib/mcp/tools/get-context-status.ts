import { prisma } from "@/lib/db";

export const getContextStatusTool = {
  name: "get_context_status" as const,
  description:
    "Returns the agent's current published context and active beacons. " +
    "Useful for checking if a re-publish is needed after MEMORY.md changes.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID (e.g. agent_arlan_001)",
      },
    },
    required: ["agent_id"],
  },
  handler: async (args: { agent_id: string }) => {
    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      include: {
        context: true,
        beacons: { where: { isActive: true } },
      },
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

    const result = {
      hasContext: !!agent.context,
      context: agent.context
        ? {
            currentWork: agent.context.currentWork,
            expertise: agent.context.expertise,
            lookingFor: agent.context.lookingFor,
            notLookingFor: agent.context.notLookingFor,
            recentProblems: agent.context.recentProblems,
            location: agent.context.location,
            networkingGoal: agent.context.networkingGoal,
            updatedAt: agent.context.updatedAt,
            previousHash: agent.context.previousHash,
          }
        : null,
      activeBeacons: agent.beacons.map((b) => ({
        beaconId: b.id,
        contextQuery: b.contextQuery,
        createdAt: b.createdAt,
        triggeredAt: b.triggeredAt,
      })),
      activeBeaconCount: agent.beacons.length,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
