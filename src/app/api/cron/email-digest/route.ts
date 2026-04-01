import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendNewMessagesEmail, shouldSend } from "@/lib/services/notification";

/**
 * Vercel Cron — runs every 5 minutes.
 * Finds chats with unread messages and sends batched email notifications.
 *
 * Logic:
 * 1. Find all OPEN chats with messages
 * 2. For each chat, check if either owner has unread messages
 * 3. Only notify if:
 *    - The oldest unread message is >5 min old (delay to allow natural reading)
 *    - The last notification for this chat+owner was >30 min ago
 *    - The owner has notifyNewMessages enabled
 * 4. Send a single email summarising all unread messages
 * 5. Update lastNotifiedA/B timestamp to prevent re-sending
 */

const MESSAGE_DELAY_MS = 5 * 60 * 1000; // 5 min — wait before notifying
const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 min — min gap between emails per chat

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const delayThreshold = new Date(now.getTime() - MESSAGE_DELAY_MS);
    const cooldownThreshold = new Date(now.getTime() - NOTIFICATION_COOLDOWN_MS);

    // Find all open chats that have at least one message
    const chats = await prisma.chat.findMany({
      where: { status: "OPEN" },
      include: {
        match: {
          include: {
            agentA: { include: { owner: true } },
            agentB: { include: { owner: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50, // enough to compute unread
        },
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const chat of chats) {
      if (chat.messages.length === 0) continue;

      const ownerA = chat.match.agentA.owner;
      const ownerB = chat.match.agentB.owner;

      // Check for owner A — do they have unread messages from B?
      const resultA = await checkAndNotify({
        chat,
        recipientOwner: ownerA,
        senderOwner: ownerB,
        lastRead: chat.lastReadByA,
        lastNotified: chat.lastNotifiedA,
        side: "A",
        now,
        delayThreshold,
        cooldownThreshold,
      });
      if (resultA === "sent") sent++;
      else skipped++;

      // Check for owner B — do they have unread messages from A?
      const resultB = await checkAndNotify({
        chat,
        recipientOwner: ownerB,
        senderOwner: ownerA,
        lastRead: chat.lastReadByB,
        lastNotified: chat.lastNotifiedB,
        side: "B",
        now,
        delayThreshold,
        cooldownThreshold,
      });
      if (resultB === "sent") sent++;
      else skipped++;
    }

    console.log(`[email-digest] Processed ${chats.length} chats: ${sent} emails sent, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      chatsProcessed: chats.length,
      emailsSent: sent,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email-digest] Cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CheckParams {
  chat: {
    id: string;
    matchId: string;
    messages: Array<{ fromOwner: string; content: string; createdAt: Date }>;
  };
  recipientOwner: { id: string; email: string; name: string | null; notifyAllEmails: boolean; notifyMatchProposals: boolean; notifyNewMessages: boolean; notifyFreshness: boolean };
  senderOwner: { id: string; name: string | null };
  lastRead: Date | null;
  lastNotified: Date | null;
  side: "A" | "B";
  now: Date;
  delayThreshold: Date;
  cooldownThreshold: Date;
}

async function checkAndNotify(params: CheckParams): Promise<"sent" | "skipped"> {
  const {
    chat,
    recipientOwner,
    senderOwner,
    lastRead,
    lastNotified,
    side,
    now,
    delayThreshold,
    cooldownThreshold,
  } = params;

  // Check preferences
  if (!shouldSend(recipientOwner, "message")) return "skipped";

  // Find unread messages from the other person
  const unreadMessages = chat.messages.filter((m) => {
    if (m.fromOwner === recipientOwner.id) return false; // sent by recipient
    if (lastRead && m.createdAt <= lastRead) return false; // already read
    return true;
  });

  if (unreadMessages.length === 0) return "skipped";

  // Check delay — oldest unread must be older than 5 min
  const oldestUnread = unreadMessages[unreadMessages.length - 1]; // messages are desc-ordered
  if (oldestUnread.createdAt > delayThreshold) return "skipped";

  // Check cooldown — last notification must be >30 min ago
  if (lastNotified && lastNotified > cooldownThreshold) return "skipped";

  // All checks passed — send the email
  const lastMessage = unreadMessages[0]; // most recent unread

  try {
    await sendNewMessagesEmail({
      ownerEmail: recipientOwner.email,
      ownerName: recipientOwner.name,
      senderName: senderOwner.name,
      messageCount: unreadMessages.length,
      lastMessagePreview: lastMessage.content,
      matchId: chat.matchId,
      ownerId: recipientOwner.id,
    });

    // Update notification timestamp
    const updateField = side === "A" ? "lastNotifiedA" : "lastNotifiedB";
    await prisma.chat.update({
      where: { id: chat.id },
      data: { [updateField]: now },
    });

    return "sent";
  } catch (err) {
    console.error(`[email-digest] Failed to notify ${recipientOwner.email}:`, err);
    return "skipped";
  }
}
