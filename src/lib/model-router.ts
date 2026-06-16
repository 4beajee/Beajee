import { getCommunityBudgetState } from "@/lib/services/community-budget";

async function getCommunityBudgetStatus(communityId: string): Promise<ModelBudgetStatus> {
  const state = await getCommunityBudgetState(communityId);
  if (state.monthlyUsdLimit && state.monthlyUsdLimit > 0) {
    return {
      monthlySpentPercent: Math.round((state.monthCostUsd / state.monthlyUsdLimit) * 100),
    };
  }
  if (state.monthlyTokenLimit && state.monthlyTokenLimit > 0) {
    return {
      monthlySpentPercent: Math.round((state.monthTokensUsed / state.monthlyTokenLimit) * 100),
    };
  }
  return { monthlySpentPercent: 0 };
}

export type ModelTask =
  | "distillation"
  | "embedding"
  | "hub_search_answer"
  | "match_scoring"
  | "activity_categorization"
  | "hub_edit_chat"
  | "strategy_participant"
  | "strategy_judge"
  | "negotiation"
  | "handshake_eval"
  | "openclaw_weekly_report";

export interface RoutingOptions {
  communityId?: string;
  forceQuality?: boolean;
}

export interface ModelBudgetStatus {
  monthlySpentPercent: number;
}

type BudgetStatusLoader = (communityId: string) => Promise<ModelBudgetStatus>;

const QUALITY_TASKS = new Set<ModelTask>([
  "hub_edit_chat",
  "strategy_participant",
  "strategy_judge",
  "negotiation",
  "handshake_eval",
  "openclaw_weekly_report",
]);

let budgetStatusLoader: BudgetStatusLoader = getCommunityBudgetStatus;

export function isQualityModelTask(task: ModelTask) {
  return QUALITY_TASKS.has(task);
}

export function getCheapModel() {
  return process.env.CHEAP_MODEL || "gemini-2.5-flash";
}

export function getQualityModel() {
  return process.env.QUALITY_MODEL || "gemini-2.5-pro";
}

export function inferModelProvider(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.startsWith("claude")) return "anthropic";
  if (normalized.startsWith("gpt") || normalized.startsWith("text-embedding")) return "openai";
  if (normalized.startsWith("gemini")) return "google";
  return "unknown";
}

export async function resolveModel(task: ModelTask, options?: RoutingOptions): Promise<string> {
  const cheapModel = getCheapModel();
  const qualityModel = getQualityModel();

  if (options?.forceQuality) return qualityModel;
  if (!isQualityModelTask(task)) return cheapModel;

  if (options?.communityId) {
    const budgetStatus = await budgetStatusLoader(options.communityId);
    if (budgetStatus.monthlySpentPercent >= 95) {
      console.warn(
        `[ModelRouter] Community ${options.communityId} is at ${budgetStatus.monthlySpentPercent}% budget. ` +
          `Degrading quality task '${task}' to cheap model.`
      );
      return cheapModel;
    }
  }

  return qualityModel;
}

export const __test = {
  setBudgetStatusLoader(loader: BudgetStatusLoader | null) {
    budgetStatusLoader = loader ?? getCommunityBudgetStatus;
  },
};
