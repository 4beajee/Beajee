import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// POST /api/feed/[matchId]/reactions
// Body: { type: "LIKE" | "DISLIKE" }
// Toggle logic: same type again → remove; different type → switch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await params;
  const body = await req.json();
  const type = body.type;

  if (type !== "LIKE" && type !== "DISLIKE") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const ownerId = session.user.id as string;

  // Check match exists and is public
  const match = await prisma.match.findFirst({
    where: { id: matchId, isPublic: true, status: "MATCHED" },
    select: { id: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { likes, dislikes, userReaction } = await prisma.$transaction(async (tx) => {
    // Serialize toggles for one owner/match pair so duplicate requests cannot race
    // through the read-then-create branch.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${matchId}:${ownerId}`}, 0))
    `;
    const existing = await tx.matchReaction.findUnique({
      where: { matchId_ownerId: { matchId, ownerId } },
    });
    let nextReaction: string | null = null;

    if (existing && existing.type === type) {
      await tx.matchReaction.delete({ where: { id: existing.id } });
    } else if (existing) {
      await tx.matchReaction.update({ where: { id: existing.id }, data: { type } });
      nextReaction = type;
    } else {
      await tx.matchReaction.create({ data: { matchId, ownerId, type } });
      nextReaction = type;
    }

    const [likeCount, dislikeCount] = await Promise.all([
      tx.matchReaction.count({ where: { matchId, type: "LIKE" } }),
      tx.matchReaction.count({ where: { matchId, type: "DISLIKE" } }),
    ]);
    return { likes: likeCount, dislikes: dislikeCount, userReaction: nextReaction };
  });

  return NextResponse.json({ likes, dislikes, userReaction });
}
