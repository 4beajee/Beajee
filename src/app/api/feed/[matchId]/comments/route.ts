import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET /api/feed/[matchId]/comments
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const match = await prisma.match.findFirst({
    where: { id: matchId, isPublic: true, status: "MATCHED" },
    select: { id: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.matchComment.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    include: {
      owner: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: {
        id: c.owner.id,
        name: c.owner.name || "Anonymous",
        image: c.owner.image,
      },
    })),
  });
}

// POST /api/feed/[matchId]/comments
// Body: { content: string }
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
  const content = (body.content || "").trim();

  if (!content || content.length > 1000) {
    return NextResponse.json(
      { error: "Comment must be 1–1000 characters" },
      { status: 400 }
    );
  }

  const ownerId = session.user.id as string;

  const match = await prisma.match.findFirst({
    where: { id: matchId, isPublic: true, status: "MATCHED" },
    select: { id: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comment = await prisma.matchComment.create({
    data: { matchId, ownerId, content },
    include: {
      owner: { select: { id: true, name: true, image: true } },
    },
  });

  const count = await prisma.matchComment.count({ where: { matchId } });

  return NextResponse.json({
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.owner.id,
        name: comment.owner.name || "Anonymous",
        image: comment.owner.image,
      },
    },
    commentCount: count,
  });
}
