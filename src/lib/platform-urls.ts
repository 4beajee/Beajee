const DEFAULT_LANDING = "https://beajee.com";
const DEFAULT_APP = "https://app.beajee.com";
const DEFAULT_MCP = "https://api.beajee.com/mcp";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export interface PlatformUrls {
  landingOrigin: string;
  appOrigin: string;
  mcpEndpoint: string;
  skillUrl: string;
  indexUrl: string;
  rulesUrl: string;
  settingsUrl: string;
  platformName: string;
  mcpServerKey: string;
}

export function getPlatformUrls(): PlatformUrls {
  const landingOrigin = stripTrailingSlash(
    process.env.NEXT_PUBLIC_LANDING_URL ?? DEFAULT_LANDING
  );
  const appOrigin = stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP);
  const mcpEndpoint = stripTrailingSlash(process.env.NEXT_PUBLIC_MCP_URL ?? DEFAULT_MCP);

  return {
    landingOrigin,
    appOrigin,
    mcpEndpoint,
    skillUrl: `${landingOrigin}/skill.md`,
    indexUrl: `${landingOrigin}/INDEX.md`,
    rulesUrl: `${landingOrigin}/skills/RULES.md`,
    settingsUrl: `${appOrigin}/settings`,
    platformName: "Beajee",
    mcpServerKey: "beajee",
  };
}