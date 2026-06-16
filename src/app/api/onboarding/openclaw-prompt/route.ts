import { NextRequest } from "next/server";
import { GET as getAgentPrompt } from "@/app/api/onboarding/agent-prompt/route";

/** @deprecated Use /api/onboarding/agent-prompt */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = "/api/onboarding/agent-prompt";
  if (!url.searchParams.has("platform")) {
    url.searchParams.set("platform", "open_claw");
  }
  const forwarded = new NextRequest(url.toString(), {
    headers: request.headers,
    method: request.method,
  });
  return getAgentPrompt(forwarded);
}
