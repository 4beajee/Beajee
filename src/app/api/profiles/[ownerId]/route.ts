import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const { ownerId } = await params;
    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        image: true,
        networkingGoal: true,
        createdAt: true,
        agent: {
          select: {
            displayName: true,
            isActive: true,
            lastActiveAt: true,
            reputationScore: true,
            reputationAcceptanceRate: true,
            reputationCompletedMatches: true,
            totalProposedMatches: true,
            interactionCount: true,
            context: {
              select: {
                ownerProfession: true,
                ownerDomain: true,
                currentWork: true,
                expertise: true,
                lookingFor: true,
                location: true,
                networkingGoal: true,
                agentSpecialization: true,
                freshnessState: true,
              },
            },
          },
        },
      },
    });

    if (!owner) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const agent = owner.agent;
    // STALE is also the immediate suppression state after privacy is tightened.
    const ctx = agent?.context?.freshnessState === "STALE" ? null : agent?.context ?? null;

    return NextResponse.json({
      id: owner.id,
      name: owner.name,
      image: owner.image,
      networkingGoal: owner.networkingGoal,
      memberSince: owner.createdAt,
      context: ctx
        ? {
            ownerProfession: ctx.ownerProfession,
            ownerDomain: ctx.ownerDomain,
            currentWork: ctx.currentWork,
            expertise: ctx.expertise,
            lookingFor: ctx.lookingFor,
            location: ctx.location,
            networkingGoal: ctx.networkingGoal,
            agentSpecialization: ctx.agentSpecialization,
          }
        : null,
      reputation: {
        score: agent?.reputationScore ?? 0,
        acceptanceRate: agent?.reputationAcceptanceRate ?? 0,
        completedMatches: agent?.reputationCompletedMatches ?? 0,
        totalProposed: agent?.totalProposedMatches ?? 0,
        interactionCount: agent?.interactionCount ?? 0,
      },
      agent: {
        displayName: agent?.displayName ?? null,
        isActive: agent?.isActive ?? false,
        lastActiveAt: agent?.lastActiveAt ?? null,
      },
    });
  } catch (error) {
    return safeErrorResponse(error, "Failed to load profile");
  }
}
