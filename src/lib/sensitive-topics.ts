import { z } from "zod";

export const SENSITIVE_TOPIC_VALUES = [
  "Health & personal issues",
  "Finances & debts",
  "Personal relationships",
  "Psychological topics",
] as const;

export const SensitiveTopicSchema = z.enum(SENSITIVE_TOPIC_VALUES);
export type SensitiveTopic = z.infer<typeof SensitiveTopicSchema>;

const TOPIC_ALIASES: Record<string, SensitiveTopic> = {
  "Health & personal issues": "Health & personal issues",
  "Finances & debts": "Finances & debts",
  "Personal relationships": "Personal relationships",
  "Psychological topics": "Psychological topics",
  "स्वास्थ्य और व्यक्तिगत मुद्दे": "Health & personal issues",
  "वित्त और ऋण": "Finances & debts",
  "व्यक्तिगत संबंध": "Personal relationships",
  "मनोवैज्ञानिक विषय": "Psychological topics",
  "健康与个人问题": "Health & personal issues",
  "财务与债务": "Finances & debts",
  "个人关系": "Personal relationships",
  "心理话题": "Psychological topics",
};

const SENSITIVE_PATTERNS: Record<SensitiveTopic, RegExp> = {
  "Health & personal issues":
    /\b(health|medical|diagnos(?:is|ed)?|doctor|hospital|medication|illness|disease|disability|surgery|treatment|cancer|pregnan(?:cy|t))\b|здоров|медиц|диагноз|врач|больниц|лекарств|болезн|инвалид|операци|лечени|беремен|स्वास्थ्य|चिकित्स|निदान|डॉक्टर|अस्पताल|दवा|बीमारी|विकलांग|स्वास्थ्य|医疗|诊断|医生|医院|药物|疾病|残疾|手术|怀孕/iu,
  "Finances & debts":
    /\b(debt|salary|income|savings|bankruptcy|mortgage|personal finances?|credit card|loan|net worth)\b|долг|зарплат|доход|сбереж|банкрот|ипотек|кредит|личн[^\n]{0,12}финанс|ऋण|वेतन|आय|बचत|दिवालिया|बंधक|व्यक्तिगत वित्त|债务|工资|收入|储蓄|破产|抵押|个人财务/iu,
  "Personal relationships":
    /\b(spouse|marriage|divorce|breakup|boyfriend|girlfriend|romantic relationship|family conflict|custody)\b|супруг|брак|развод|расставан|парень|девушк|романтическ|семейн[^\n]{0,12}конфликт|पति|पत्नी|विवाह|तलाक|ब्रेकअप|प्रेमी|प्रेमिका|पारिवारिक विवाद|配偶|婚姻|离婚|分手|男朋友|女朋友|家庭冲突/iu,
  "Psychological topics":
    /\b(therapy|depression|anxiety|burnout|trauma|mental health|psychiatr|suicid|panic attack|addiction)\b|терапи|депресс|тревож|выгоран|травм|психическ|психиатр|суицид|паническ|зависимост|थेरेपी|अवसाद|चिंता|बर्नआउट|आघात|मानसिक स्वास्थ्य|आत्महत्या|लत|治疗|抑郁|焦虑|倦怠|创伤|心理健康|精神科|自杀|成瘾/iu,
};

export interface SensitiveContextViolation {
  field: string;
  categories: SensitiveTopic[];
}

export class SensitiveContextError extends Error {
  readonly code = "SENSITIVE_CONTEXT_EXCLUDED";

  constructor(readonly violations: SensitiveContextViolation[]) {
    super("Context contains topics the owner excluded from matching");
    this.name = "SensitiveContextError";
  }
}

export function normalizeSensitiveTopics(topics: readonly string[]): SensitiveTopic[] {
  return [
    ...new Set(
      topics
        .map((topic) => TOPIC_ALIASES[topic])
        .filter((topic): topic is SensitiveTopic => topic !== undefined)
    ),
  ];
}

export function findSensitiveContextViolations(
  context: Record<string, unknown>,
  excludedTopics: readonly string[]
): SensitiveContextViolation[] {
  const excluded = normalizeSensitiveTopics(excludedTopics);
  if (excluded.length === 0) return [];

  const violations: SensitiveContextViolation[] = [];
  for (const [field, rawValue] of Object.entries(context)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    const text = values.filter((value): value is string => typeof value === "string").join("\n");
    if (!text) continue;
    const categories = excluded.filter((topic) => SENSITIVE_PATTERNS[topic].test(text));
    if (categories.length > 0) violations.push({ field, categories });
  }
  return violations;
}

export function assertContextRespectsExclusions(
  context: Record<string, unknown>,
  excludedTopics: readonly string[]
) {
  const violations = findSensitiveContextViolations(context, excludedTopics);
  if (violations.length > 0) throw new SensitiveContextError(violations);
}
