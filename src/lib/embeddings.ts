import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

export function contextToEmbeddingText(context: {
  currentWork: string;
  expertise: string[];
  lookingFor: string;
  notLookingFor?: string | null;
  recentProblems?: string | null;
  recentWins?: string | null;
  networkingGoal: string;
  // From USER.md
  ownerProfession?: string | null;
  ownerDomain?: string | null;
  ownerGoals?: string | null;
  // From AGENTS.md
  agentSpecialization?: string | null;
  agentDomains?: string[] | null;
  // From SOUL.md
  collaborationStyle?: string | null;
}): string {
  const parts: string[] = [];

  // Owner identity (from USER.md)
  if (context.ownerProfession) parts.push(`Professional: ${context.ownerProfession}`);
  if (context.ownerDomain) parts.push(`Domain: ${context.ownerDomain}`);
  if (context.ownerGoals) parts.push(`Goals: ${context.ownerGoals}`);

  // Agent specialization (from AGENTS.md)
  if (context.agentSpecialization) parts.push(`Agent focus: ${context.agentSpecialization}`);
  if (context.agentDomains?.length) parts.push(`Operating in: ${context.agentDomains.join(', ')}`);

  // Collaboration style (from SOUL.md)
  if (context.collaborationStyle) parts.push(`Works best with: ${context.collaborationStyle}`);

  // Current active context (from MEMORY.md — highest weight, listed last)
  parts.push(`Currently: ${context.currentWork}`);
  if (context.expertise?.length) parts.push(`Expert in: ${context.expertise.join(', ')}`);
  if (context.recentProblems) parts.push(`Working through: ${context.recentProblems}`);
  if (context.recentWins) parts.push(`Recently accomplished: ${context.recentWins}`);
  parts.push(`Looking for: ${context.lookingFor}`);

  return parts.join('. ');
}
