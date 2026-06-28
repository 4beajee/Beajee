export type ModelTask =
  | "match_scoring"
  | "negotiation"
  | "openclaw_weekly_report";

export interface RoutingOptions {
  forceQuality?: boolean;
}

const QUALITY_TASKS = new Set<ModelTask>([
  "negotiation",
  "openclaw_weekly_report",
]);

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

  return options?.forceQuality || isQualityModelTask(task) ? qualityModel : cheapModel;
}
