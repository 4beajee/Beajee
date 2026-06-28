export interface QuestionContext {
  currentWork?: string | null;
  expertise?: string[] | null;
  lookingFor?: string | null;
  recentProblems?: string | null;
}

export interface GeneratedContextQuestion {
  sequence: number;
  topic: "current_need" | "ideal_connection" | "value_offer" | "hidden_context";
  prompt: string;
  reason: string;
  followUpPrompt?: string;
}

function compact(value: string | null | undefined, fallback: string, max = 110) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trim()}…`;
}

export function buildContextQuestions(context: QuestionContext): GeneratedContextQuestion[] {
  const work = compact(context.currentWork, "your current work");
  const need = compact(context.lookingFor, "the kind of person you want to meet");
  const expertise = compact(context.expertise?.slice(0, 3).join(", "), "your strongest experience");

  return [
    {
      sequence: 10,
      topic: "current_need",
      prompt: `Thinking about ${work}: what is hardest to move forward without the right person?`,
      reason: "A current bottleneck makes introductions timely instead of generally relevant.",
      followUpPrompt: "What concrete experience or access would make that person genuinely useful?",
    },
    {
      sequence: 20,
      topic: "ideal_connection",
      prompt: `You are currently looking for ${need}. What should one useful meeting help you accomplish in the next month?`,
      reason: "A desired outcome lets Beajee distinguish similar-looking candidates.",
      followUpPrompt: "How would you know, after the meeting, that it was worth your time?",
    },
    {
      sequence: 30,
      topic: "value_offer",
      prompt: `Beyond ${expertise}, what can you help another person with especially well right now?`,
      reason: "Mutual value is required before Beajee proposes an introduction.",
    },
    {
      sequence: 40,
      topic: "hidden_context",
      prompt: "What important project, transition, or curiosity is mostly invisible to your current agent?",
      reason: "Coding and work agents often see only one slice of an owner's life and work.",
    },
  ];
}

export function shouldAskClarifyingQuestion(answer: string) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length < 8;
}

export function getQuestionCadenceKey(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const SENSITIVE_PATTERNS: Record<string, RegExp> = {
  "Health & personal issues": /\b(health|medical|diagnos|doctor|hospital|medication|illness|disability)\b/i,
  "Finances & debts": /\b(debt|salary|income|savings|bankruptcy|mortgage|personal finances?)\b/i,
  "Personal relationships": /\b(spouse|marriage|divorce|breakup|boyfriend|girlfriend|family conflict)\b/i,
  "Psychological topics": /\b(therapy|depression|anxiety|burnout|trauma|mental health|diagnosis)\b/i,
};

export function isExcludedSensitiveAnswer(answer: string, excludedTopics: string[]) {
  return excludedTopics.some((topic) => SENSITIVE_PATTERNS[topic]?.test(answer) ?? false);
}
