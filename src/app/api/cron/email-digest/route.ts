import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  sendNewMessagesEmail,
  sendMatchProposalEmail,
  sendMatchConfirmedEmail,
  sendFreshnessWarningEmail,
  shouldSend,
} from "@/lib/services/notification";
import {
  getEmailFallbackCandidates,
  markEmailFallbackSent,
} from "@/lib/services/inbox";

/**
 * Email fallback for undelivered inbox events.
 *
 * Primary delivery is via the agent (check_in MCP tool + ack_inbox).
 * If an event stays undelivered for FALLBACK_THRESHOLD_MS, we send email
 * based on the owner's notification preferences.
 */

const FALLBACK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

type PayloadRecord = Record<string, unknown>;

function asString(payload: PayloadRecord, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function asNumber(payload: PayloadRecord, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const candidates = await getEmailFallbackCandidates(FALLBACK_THRESHOLD_MS);

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, processed: 0, sent: 0, skipped: 0 });
    }

    const ownerIds = Array.from(new Set(candidates.map((e) => e.ownerId)));
    const owners = await prisma.owner.findMany({
      where: { id: { in: ownerIds } },
      select: {
        id: true,
        email: true,
        name: true,
        notifyAllEmails: true,
        notifyMatchProposals: true,
        notifyNewMessages: true,
        notifyFreshness: true,
      },
    });
    const ownerById = new Map(owners.map((o) => [o.id, o]));

    let sent = 0;
    let skipped = 0;
    const processedIds: string[] = [];

    for (const event of candidates) {
      const owner = ownerById.get(event.ownerId);
      if (!owner) {
        processedIds.push(event.id);
        skipped++;
        continue;
      }

      const payload = (event.payload ?? {}) as PayloadRecord;
      let didSend = false;

      try {
        if (event.type === "MATCH_PROPOSED" && shouldSend(owner, "match")) {
          await sendMatchProposalEmail({
            ownerEmail: owner.email,
            ownerName: owner.name,
            otherPersonName: asString(payload, "other_owner_name"),
            framing: asString(payload, "framing") ?? "",
            matchId: asString(payload, "match_id") ?? event.referenceId,
            ownerId: owner.id,
          });
          didSend = true;
        } else if (event.type === "MATCH_CONFIRMED" && shouldSend(owner, "match")) {
          await sendMatchConfirmedEmail({
            ownerEmail: owner.email,
            ownerName: owner.name,
            otherPersonName: asString(payload, "other_owner_name"),
            overlapSummary: asString(payload, "overlap_summary") ?? "",
            matchId: asString(payload, "match_id") ?? event.referenceId,
            ownerId: owner.id,
          });
          didSend = true;
        } else if (event.type === "NEW_MESSAGE" && shouldSend(owner, "message")) {
          await sendNewMessagesEmail({
            ownerEmail: owner.email,
            ownerName: owner.name,
            senderName: asString(payload, "from_owner_name"),
            messageCount: 1,
            lastMessagePreview: asString(payload, "message_preview") ?? "",
            matchId: asString(payload, "match_id") ?? "",
            ownerId: owner.id,
          });
          didSend = true;
        } else if (event.type === "FRESHNESS_WARNING" && shouldSend(owner, "freshness")) {
          const state = asString(payload, "new_state");
          if (state === "AGING" || state === "STALE") {
            await sendFreshnessWarningEmail({
              ownerEmail: owner.email,
              ownerName: owner.name,
              newState: state,
              daysSinceUpdate: asNumber(payload, "days_since_update") ?? 0,
              ownerId: owner.id,
              agentId: event.referenceId,
            });
            didSend = true;
          }
        }
      } catch (err) {
        console.error(`[email-digest] Failed to send fallback for event ${event.id}:`, err);
      }

      // Mark processed either way — sent or skipped by preference. We don't
      // retry; preference changes take effect on subsequent events.
      processedIds.push(event.id);
      if (didSend) sent++;
      else skipped++;
    }

    await markEmailFallbackSent(processedIds);

    console.log(`[email-digest] Processed ${candidates.length} events: ${sent} sent, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      processed: candidates.length,
      sent,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email-digest] Cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
