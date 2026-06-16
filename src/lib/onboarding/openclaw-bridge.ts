export interface OpenClawBridgeConfigParams {
  agentId: string;
  apiKey: string;
}

import { getPlatformUrls } from "@/lib/platform-urls";

export function getOpenClawBridgePaths() {
  const urls = getPlatformUrls();

  return {
    appOrigin: urls.appOrigin,
    landingOrigin: urls.landingOrigin,
    bridgeScriptUrl: `${urls.landingOrigin}/tools/gennety-openclaw-bridge.mjs`,
    bridgeDocsUrl: `${urls.landingOrigin}/tools/gennety-openclaw-bridge.md`,
    bridgeConfigPath: "~/.config/beajee/openclaw-bridge.json",
    wakeStreamUrl: `${urls.appOrigin}/api/agent/wake/stream`,
    mcpUrl: urls.mcpEndpoint,
  };
}

export function buildOpenClawBridgeConfig(params: OpenClawBridgeConfigParams) {
  const paths = getOpenClawBridgePaths();

  return JSON.stringify(
    {
      agentId: params.agentId,
      apiKey: params.apiKey,
      appUrl: paths.appOrigin,
      mcpUrl: paths.mcpUrl,
      wakeStreamUrl: paths.wakeStreamUrl,
      openclaw: {
        bin: "openclaw",
        local: false,
      },
      delivery: {
        mode: "agent_turn",
        agent: "main",
        backgroundSessionId: "beajee-bridge-bg",
        thinking: "off",
      },
      polling: {
        minWakeReconnectMs: 5000,
        maxWakeReconnectMs: 300000,
      },
    },
    null,
    2
  );
}
