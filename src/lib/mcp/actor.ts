export interface McpActor {
  internalAgentId: string;
  externalAgentId: string;
  ownerId: string;
}

export function requireMcpActor(actor: McpActor | undefined): McpActor {
  if (!actor) {
    throw new Error("Authenticated MCP actor context is required");
  }
  return actor;
}
