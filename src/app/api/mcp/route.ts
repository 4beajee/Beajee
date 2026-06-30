import { NextRequest, NextResponse } from "next/server";
import { publishContextTool } from "@/lib/mcp/tools/publish-context";
import { findMatchesTool } from "@/lib/mcp/tools/find-matches";
import { setBeaconTool } from "@/lib/mcp/tools/set-beacon";
import { initiateNegotiationTool } from "@/lib/mcp/tools/initiate-negotiation";
import { negotiateTool } from "@/lib/mcp/tools/negotiate";
import { proposeMatchTool } from "@/lib/mcp/tools/propose-match";
import { confirmMatchTool } from "@/lib/mcp/tools/confirm-match";
import { markDormantTool } from "@/lib/mcp/tools/mark-dormant";
import { getMatchesTool } from "@/lib/mcp/tools/get-matches";
import { getContextStatusTool } from "@/lib/mcp/tools/get-context-status";
import { reportChatTool } from "@/lib/mcp/tools/report-chat";
import { blockUserTool } from "@/lib/mcp/tools/block-user";
import { archiveChatTool } from "@/lib/mcp/tools/archive-chat";
import { getReputationTool } from "@/lib/mcp/tools/get-reputation";
import { checkInTool } from "@/lib/mcp/tools/check-in";
import { ackInboxTool } from "@/lib/mcp/tools/ack-inbox";
import { sendChatMessageTool } from "@/lib/mcp/tools/send-chat-message";
import { requestZoomCallTool } from "@/lib/mcp/tools/request-zoom-call";
import { findCallSlotsTool } from "@/lib/mcp/tools/find-call-slots";
import { proposeCallTimeTool } from "@/lib/mcp/tools/propose-call-time";
import { confirmCallTimeTool } from "@/lib/mcp/tools/confirm-call-time";
import { getCallStatusTool } from "@/lib/mcp/tools/get-call-status";
import { setSchedulingUrlTool } from "@/lib/mcp/tools/set-scheduling-url";
import { answerContextQuestionTool } from "@/lib/mcp/tools/answer-context-question";
import { confirmContextQuestionBatchTool } from "@/lib/mcp/tools/confirm-context-question-batch";
import { setSocialProfilesTool } from "@/lib/mcp/tools/set-social-profiles";
import { authenticateAgent } from "@/lib/mcp/auth";
import type { McpActor } from "@/lib/mcp/actor";
import { rateLimit } from "@/lib/rate-limit";

const tools = [
  publishContextTool,
  findMatchesTool,
  setBeaconTool,
  initiateNegotiationTool,
  negotiateTool,
  proposeMatchTool,
  confirmMatchTool,
  markDormantTool,
  getMatchesTool,
  getContextStatusTool,
  reportChatTool,
  blockUserTool,
  archiveChatTool,
  getReputationTool,
  checkInTool,
  ackInboxTool,
  sendChatMessageTool,
  requestZoomCallTool,
  findCallSlotsTool,
  proposeCallTimeTool,
  confirmCallTimeTool,
  getCallStatusTool,
  setSchedulingUrlTool,
  answerContextQuestionTool,
  confirmContextQuestionBatchTool,
  setSocialProfilesTool,
];

// JSON-RPC 2.0 handler for MCP protocol
export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { maxRequests: 60, windowMs: 60_000, keyPrefix: "mcp" });
  if (rateLimited) return rateLimited;

  try {
    // Authenticate via API key in Authorization header
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.replace("Bearer ", "") ?? null;
    const agent = await authenticateAgent(apiKey);

    if (!agent) {
      return NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized: invalid API key" }, id: null },
        { status: 401 }
      );
    }

    let body: { method?: string; params?: Record<string, unknown>; id?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32700, message: "Parse error: invalid JSON body" }, id: null },
        { status: 400 }
      );
    }

    const { method, params, id } = body;

    // Handle MCP protocol methods
    switch (method) {
      case "initialize": {
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "beajee", version: "1.0.0" },
          },
          id,
        });
      }

      case "notifications/initialized": {
        return new NextResponse(null, { status: 202 });
      }

      case "tools/list": {
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
          id,
        });
      }

      case "tools/call": {
        const { name, arguments: rawArgs } = (params ?? {}) as {
          name?: string;
          arguments?: unknown;
        };
        const args = rawArgs as Record<string, unknown> | undefined;

        if (typeof name !== "string") {
          return NextResponse.json({
            jsonrpc: "2.0",
            error: { code: -32602, message: "Invalid params: tool name is required" },
            id,
          });
        }

        const tool = tools.find((t) => t.name === name);

        if (!tool) {
          return NextResponse.json({
            jsonrpc: "2.0",
            error: { code: -32602, message: `Unknown tool: ${name}` },
            id,
          });
        }

        try {
          const actor: McpActor = {
            internalAgentId: agent.id,
            externalAgentId: agent.agentId,
            ownerId: agent.ownerId,
          };
          const externalAgentId = typeof args?.agent_id === "string" ? args.agent_id : undefined;
          const internalAgentId = typeof args?.agentId === "string" ? args.agentId : undefined;
          // Enforce agent identity — if tool args contain agent_id, it must match authenticated agent
          if (externalAgentId && externalAgentId !== agent.agentId) {
            return NextResponse.json({
              jsonrpc: "2.0",
              result: {
                content: [{ type: "text", text: JSON.stringify({ error: `Identity mismatch: authenticated as ${agent.agentId} but tool called with ${externalAgentId}` }) }],
                isError: true,
              },
              id,
            });
          }

          if (internalAgentId && ![agent.id, agent.agentId].includes(internalAgentId)) {
            return NextResponse.json({
              jsonrpc: "2.0",
              result: {
                content: [{ type: "text", text: JSON.stringify({ error: `Identity mismatch: authenticated as ${agent.agentId} but tool called with agentId=${internalAgentId}` }) }],
                isError: true,
              },
              id,
            });
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await tool.handler(args as any, actor as any);
          return NextResponse.json({ jsonrpc: "2.0", result, id });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return NextResponse.json({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify({ error: message }) }],
              isError: true,
            },
            id,
          });
        }
      }

      default: {
        return NextResponse.json({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Method not found: ${method}` },
          id,
        });
      }
    }
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development"
        ? (error instanceof Error ? error.message : String(error))
        : "Internal server error";
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32603, message }, id: null },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    name: "beajee-mcp",
    version: "1.0.0",
    tools: tools.map((t) => t.name),
    status: "ok",
  });
}
