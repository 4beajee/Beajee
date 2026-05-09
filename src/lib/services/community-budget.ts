import { prisma } from "@/lib/db";

export class CommunityBudgetError extends Error {
  constructor(
    message: string,
    public readonly status = 402
  ) {
    super(message);
  }
}

export interface CommunityBudgetState {
  communityId: string;
  sessionTokenLimit: number;
  monthlyTokenLimit: number | null;
  strategyUsdLimit: number | null;
  monthlyUsdLimit: number | null;
  monthTokensUsed: number;
  monthCostUsd: number;
  remainingMonthlyTokens: number | null;
  remainingMonthlyUsd: number | null;
}

export function estimateStrategyTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function canSpendCommunityTokens(args: {
  requestedTokens: number;
  requestedCostUsd?: number;
  sessionTokenLimit: number;
  sessionTokensUsed: number;
  strategyUsdLimit?: number | null;
  monthlyTokenLimit?: number | null;
  monthTokensUsed?: number;
  monthlyUsdLimit?: number | null;
  monthCostUsd?: number;
}) {
  const sessionRemaining = args.sessionTokenLimit - args.sessionTokensUsed;
  if (args.requestedTokens > sessionRemaining) {
    return {
      allowed: false,
      reason: "SESSION_LIMIT",
      remainingTokens: Math.max(0, sessionRemaining),
    } as const;
  }

  if (args.monthlyTokenLimit !== null && args.monthlyTokenLimit !== undefined) {
    const monthlyRemaining = args.monthlyTokenLimit - (args.monthTokensUsed ?? 0);
    if (args.requestedTokens > monthlyRemaining) {
      return {
        allowed: false,
        reason: "MONTHLY_LIMIT",
        remainingTokens: Math.max(0, monthlyRemaining),
      } as const;
    }
  }
  if (
    args.strategyUsdLimit !== null &&
    args.strategyUsdLimit !== undefined &&
    (args.requestedCostUsd ?? 0) > args.strategyUsdLimit
  ) {
    return {
      allowed: false,
      reason: "SESSION_USD_LIMIT",
      remainingTokens: sessionRemaining,
    } as const;
  }
  if (args.monthlyUsdLimit !== null && args.monthlyUsdLimit !== undefined) {
    const remainingUsd = args.monthlyUsdLimit - (args.monthCostUsd ?? 0);
    if ((args.requestedCostUsd ?? 0) > remainingUsd) {
      return {
        allowed: false,
        reason: "MONTHLY_USD_LIMIT",
        remainingTokens: sessionRemaining,
      } as const;
    }
  }

  return {
    allowed: true,
    reason: null,
    remainingTokens: sessionRemaining - args.requestedTokens,
  } as const;
}

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getCommunityBudgetState(communityId: string, now = new Date()): Promise<CommunityBudgetState> {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      strategyTokenLimit: true,
      monthlyTokenLimit: true,
      strategyUsdLimit: true,
      monthlyUsdLimit: true,
    },
  });

  if (!community) throw new CommunityBudgetError("Community not found", 404);

  const aggregate = await prisma.computeUsage.aggregate({
    where: {
      communityId,
      createdAt: { gte: monthStart(now) },
    },
    _sum: {
      tokensInput: true,
      tokensOutput: true,
      costUsd: true,
    },
  });

  const monthTokensUsed =
    (aggregate._sum.tokensInput ?? 0) + (aggregate._sum.tokensOutput ?? 0);
  const remainingMonthlyTokens =
    community.monthlyTokenLimit === null
      ? null
      : Math.max(0, community.monthlyTokenLimit - monthTokensUsed);
  const monthCostUsd = aggregate._sum.costUsd ?? 0;
  const remainingMonthlyUsd =
    community.monthlyUsdLimit === null
      ? null
      : Math.max(0, community.monthlyUsdLimit - monthCostUsd);

  return {
    communityId,
    sessionTokenLimit: community.strategyTokenLimit,
    monthlyTokenLimit: community.monthlyTokenLimit,
    strategyUsdLimit: community.strategyUsdLimit,
    monthlyUsdLimit: community.monthlyUsdLimit,
    monthTokensUsed,
    monthCostUsd,
    remainingMonthlyTokens,
    remainingMonthlyUsd,
  };
}

export async function assertCommunityBudgetAvailable(args: {
  communityId: string;
  requestedTokens: number;
  requestedCostUsd?: number;
  sessionTokensUsed?: number;
  sessionTokenLimit?: number;
}) {
  const state = await getCommunityBudgetState(args.communityId);
  const decision = canSpendCommunityTokens({
    requestedTokens: args.requestedTokens,
    requestedCostUsd: args.requestedCostUsd,
    sessionTokenLimit: args.sessionTokenLimit ?? state.sessionTokenLimit,
    sessionTokensUsed: args.sessionTokensUsed ?? 0,
    strategyUsdLimit: state.strategyUsdLimit,
    monthlyTokenLimit: state.monthlyTokenLimit,
    monthTokensUsed: state.monthTokensUsed,
    monthlyUsdLimit: state.monthlyUsdLimit,
    monthCostUsd: state.monthCostUsd,
  });

  if (!decision.allowed) {
    throw new CommunityBudgetError(
      decision.reason === "MONTHLY_LIMIT"
        ? "Community monthly token limit exceeded"
        : decision.reason === "SESSION_USD_LIMIT"
        ? "Community strategy session USD limit exceeded"
        : decision.reason === "MONTHLY_USD_LIMIT"
        ? "Community monthly USD limit exceeded"
        : "Community strategy session token limit exceeded"
    );
  }

  return { state, decision };
}
