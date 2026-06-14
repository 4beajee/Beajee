import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/api-error";
import {
  confirmCallTime,
  generateZoomLinkNow,
  getMatchCallStatus,
  proposeCallTime,
  requestZoomCall,
} from "@/lib/services/match-call";
import { findOverlappingCallSlots } from "@/lib/services/calendar-slots";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ matchId: string }> };

async function assertMatchParticipant(matchId: string, ownerId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agentA: { select: { owner: { select: { id: true } } } },
      agentB: { select: { owner: { select: { id: true } } } },
    },
  });
  if (!match) return null;
  const isParticipant =
    match.agentA.owner.id === ownerId || match.agentB.owner.id === ownerId;
  if (!isParticipant) return null;
  return match;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedOwner();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await context.params;
  const match = await assertMatchParticipant(matchId, auth.ownerId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const call = await getMatchCallStatus(matchId, auth.ownerId);
  return NextResponse.json(call);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedOwner();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await context.params;
  const match = await assertMatchParticipant(matchId, auth.ownerId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    switch (action) {
      case "request_call": {
        const result = await requestZoomCall(matchId, auth.ownerId);
        return NextResponse.json(result);
      }
      case "generate_link": {
        const result = await generateZoomLinkNow(matchId, auth.ownerId);
        return NextResponse.json(result);
      }
      case "find_slots": {
        const slots = await findOverlappingCallSlots(
          match.agentA.owner.id,
          match.agentB.owner.id
        );
        return NextResponse.json(slots);
      }
      case "propose_time": {
        const slots = Array.isArray(body.slots) ? body.slots : [];
        const normalized = slots
          .filter((s): s is { start: string; end: string } => {
            return (
              !!s &&
              typeof s === "object" &&
              typeof (s as { start?: unknown }).start === "string" &&
              typeof (s as { end?: unknown }).end === "string"
            );
          })
          .map((s) => ({ start: s.start, end: s.end }));
        const result = await proposeCallTime(matchId, auth.ownerId, normalized);
        return NextResponse.json(result);
      }
      case "confirm_time": {
        const proposalId = typeof body.proposalId === "string" ? body.proposalId : "";
        if (!proposalId) {
          return NextResponse.json({ error: "proposalId is required" }, { status: 400 });
        }
        const result = await confirmCallTime(matchId, auth.ownerId, proposalId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return safeErrorResponse(error, "Call action failed", 400);
  }
}