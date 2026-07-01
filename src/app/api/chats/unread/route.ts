import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { getUnreadMessageCounts } from "@/lib/services/unread-messages";

// GET /api/chats/unread — total unread message count across all chats
export async function GET() {
  const auth = await getAuthenticatedOwner();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = auth.ownerId;

  const counts = await getUnreadMessageCounts(ownerId);
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);

  return NextResponse.json({ unread: total });
}
