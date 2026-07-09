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

export function buildContextQuestions(context: QuestionContext): GeneratedContextQuestion[] {
  void context;
  return [
    {
      sequence: 10,
      topic: "current_need",
      prompt: "Что сейчас сильнее всего тормозит движение вперёд в вашей работе?",
      reason: "Текущий барьер помогает делать знакомства своевременными и конкретными.",
    },
    {
      sequence: 20,
      topic: "ideal_connection",
      prompt: "Какой результат от одного полезного знакомства был бы для вас наиболее ценным в ближайший месяц?",
      reason: "Желаемый результат помогает отличать похожих кандидатов друг от друга.",
    },
    {
      sequence: 30,
      topic: "value_offer",
      prompt: "Чем вы можете быть особенно полезны нужному человеку прямо сейчас?",
      reason: "Взаимная ценность нужна до того, как Beajee предложит знакомство.",
    },
    {
      sequence: 40,
      topic: "hidden_context",
      prompt: "Есть ли сейчас важный проект, переход или интерес, о котором ваш агент может не знать?",
      reason: "Агенты часто видят лишь часть профессионального контекста владельца.",
    },
  ];
}

export function getQuestionCadenceKey(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function isExcludedSensitiveAnswer(answer: string, excludedTopics: string[]) {
  return findSensitiveContextViolations({ answer }, excludedTopics).length > 0;
}
import { findSensitiveContextViolations } from "@/lib/sensitive-topics";
