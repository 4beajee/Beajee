import {
  PLATFORM_FILE_NAMES,
  PLATFORM_LABELS,
  type AgentPlatform,
} from "@/types/onboarding";

export interface ConnectionInstruction {
  title: string;
  description: string;
  steps: string[];
  codeSnippet?: string;
  codeLanguage?: string;
}

export function getConnectionInstructions(
  agentId: string,
  apiKey: string,
  platform: AgentPlatform = "open_claw"
): ConnectionInstruction {
  const fileName = PLATFORM_FILE_NAMES[platform];
  const label = PLATFORM_LABELS[platform];

  return {
    title: label,
    description: `Copy the setup prompt and paste it to your ${label} agent.`,
    steps: [
      `Copy the setup prompt below`,
      `Paste it into your ${label} agent`,
      `The agent fetches instructions, creates ${fileName}, configures MCP, and verifies the connection — all automatically`,
    ],
  };
}

/** Build the one-liner prompt the user copies and pastes to their agent. */
export function buildSetupPrompt(agentId: string, apiKey: string, baseUrl: string): string {
  const origin = baseUrl.replace(/\/$/, "");
  return `Fetch ${origin}/api/setup/${agentId}?key=${apiKey} and follow the Gennety setup instructions in the response. Create the files and configure the MCP server as described.`;
}
