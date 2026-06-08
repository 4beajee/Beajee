export interface OpenClawBridgeConfigParams {
  agentId: string;
  apiKey: string;
}

export function getOpenClawBridgePaths() {
  const landingOrigin = (process.env.NEXT_PUBLIC_LANDING_URL ?? "https://beajee.com").replace(/\/$/, "");
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.beajee.com").replace(/\/$/, "");

  return {
    appOrigin,
    landingOrigin,
    bridgeScriptUrl: `${landingOrigin}/tools/beajee-openclaw-bridge.mjs`,
    bridgeDocsUrl: `${landingOrigin}/tools/beajee-openclaw-bridge.md`,
    bridgeConfigPath: "~/.config/beajee/openclaw-bridge.json",
    wakeStreamUrl: `${appOrigin}/api/agent/wake/stream`,
    mcpUrl: "https://api.beajee.com/mcp",
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
