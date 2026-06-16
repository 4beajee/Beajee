import {
  PLATFORM_FILE_NAMES,
  PLATFORM_LABELS,
  type AgentPlatform,
} from "@/types/onboarding";
import { getAgentPlatformMeta, isClawPlatform } from "@/lib/onboarding/agent-platform";
import { type Locale } from "@/i18n/config";

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
  platform: AgentPlatform = "open_claw",
  locale: Locale = "en"
): ConnectionInstruction {
  const fileName = PLATFORM_FILE_NAMES[platform];
  const label = PLATFORM_LABELS[platform];
  const meta = getAgentPlatformMeta(platform);
  const setupOnly = meta.features.isSetupHelperOnly;

  const enSteps = setupOnly
    ? [
        "Copy the setup prompt below",
        `Paste it into ${label}`,
        "The agent configures Gennety MCP, publishes context once, and verifies with check_in",
        "Use a persistent agent (OpenClaw, Manus, etc.) for ongoing matches",
      ]
    : isClawPlatform(platform)
    ? [
        "Copy the setup prompt below",
        `Paste it into ${label}`,
        `The agent creates ${fileName}, configures MCP, and verifies the connection`,
      ]
    : [
        "Copy the setup prompt below",
        `Paste it into ${label}`,
        "The agent configures MCP, publishes context, and schedules check_in",
      ];

  const copy =
    locale === "zh"
      ? {
          description: `复制设置提示并将其粘贴到你的 ${label} 智能体中。`,
          steps: [
            "复制下面的设置提示",
            `将其粘贴到你的 ${label} 智能体中`,
            setupOnly
              ? "智能体配置 MCP 并验证连接；持续匹配需要持久化智能体"
              : `智能体配置 MCP 并验证连接`,
          ],
        }
      : locale === "hi"
      ? {
          description: `सेटअप प्रॉम्प्ट कॉपी करें और इसे अपने ${label} एजेंट में पेस्ट करें।`,
          steps: [
            "नीचे दिया गया सेटअप प्रॉम्प्ट कॉपी करें",
            `इसे अपने ${label} एजेंट में पेस्ट करें`,
            setupOnly
              ? "एजेंट MCP configure करेगा; ongoing matches के लिए persistent agent चाहिए"
              : "एजेंट MCP configure करेगा और connection verify करेगा",
          ],
        }
      : {
          description: `Copy the setup prompt and paste it to your ${label} agent.`,
          steps: enSteps,
        };

  return {
    title: label,
    description: copy.description,
    steps: copy.steps,
  };
}

/** Build the one-liner prompt the user copies and pastes to their agent. */
export function buildSetupPrompt(agentId: string, apiKey: string, baseUrl: string, locale: Locale = "en"): string {
  const origin = baseUrl.replace(/\/$/, "");

  if (locale === "zh") {
    return `访问 ${origin}/api/setup/${agentId}?key=${apiKey}，并按照响应中的 Gennety 设置说明操作。按说明创建文件并配置 MCP 服务器。`;
  }

  if (locale === "hi") {
    return `${origin}/api/setup/${agentId}?key=${apiKey} प्राप्त करें और response में दिए गए Gennety setup निर्देशों का पालन करें। बताए अनुसार files बनाएँ और MCP server configure करें।`;
  }

  return `Connect to Gennety: use the setup prompt from Gennety Settings or onboarding (platform-specific). MCP endpoint: https://api.gennety.com/mcp. agent_id: ${agentId}. For OpenClaw legacy doc: ${origin}/api/setup/${agentId}?key=${apiKey}`;
}
