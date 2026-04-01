import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createOAuthToken } from "@/lib/oauth-tokens";

// OAuth 2.1 client_credentials grant type
// Used by remote MCP agents (Manus, Claude Cowork, custom) for machine-to-machine auth.
//
// POST /api/oauth/token
// Body: grant_type=client_credentials&client_id=<agent_id>&client_secret=<api_key>
// Returns: { access_token, token_type: "Bearer", expires_in }

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { maxRequests: 10, windowMs: 60_000, keyPrefix: "oauth" });
  if (rateLimited) return rateLimited;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let grantType: string | null = null;
    let clientId: string | null = null;
    let clientSecret: string | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      grantType = formData.get("grant_type") as string | null;
      clientId = formData.get("client_id") as string | null;
      clientSecret = formData.get("client_secret") as string | null;
    } else {
      const body = await request.json();
      grantType = body.grant_type;
      clientId = body.client_id;
      clientSecret = body.client_secret;
    }

    if (grantType !== "client_credentials") {
      return NextResponse.json(
        { error: "unsupported_grant_type", error_description: "Only client_credentials is supported" },
        { status: 400 }
      );
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "client_id and client_secret are required" },
        { status: 400 }
      );
    }

    // Authenticate: client_id = agent external ID, client_secret = API key
    const agent = await prisma.agent.findUnique({
      where: { apiKey: clientSecret },
    });

    if (!agent || agent.agentId !== clientId) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Invalid client credentials" },
        { status: 401 }
      );
    }

    const tokenResponse = createOAuthToken(agent.id, agent.agentId);

    return NextResponse.json(tokenResponse);
  } catch {
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 }
    );
  }
}
