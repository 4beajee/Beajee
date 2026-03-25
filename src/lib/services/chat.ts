import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

interface MatchContext {
  overlapSummary: string;
  framingForA: string;
  framingForB: string;
  ownerA: { name: string | null; currentWork: string | null; expertise: string[] };
  ownerB: { name: string | null; currentWork: string | null; expertise: string[] };
}

async function generateOpeningMessage(
  ctx: MatchContext,
  forOwner: "A" | "B"
): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) {
    // Fallback when API key not configured
    const framing = forOwner === "A" ? ctx.framingForA : ctx.framingForB;
    return `Here's why you should talk: ${ctx.overlapSummary}\n\n${framing}`;
  }

  const ownerName = forOwner === "A" ? ctx.ownerA.name : ctx.ownerB.name;
  const otherName = forOwner === "A" ? ctx.ownerB.name : ctx.ownerA.name;
  const otherWork = forOwner === "A" ? ctx.ownerB.currentWork : ctx.ownerA.currentWork;
  const framing = forOwner === "A" ? ctx.framingForA : ctx.framingForB;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Generate a warm, specific opening message for ${ownerName ?? "this person"} to start a conversation with ${otherName ?? "their new connection"}.

Why they're meeting: ${ctx.overlapSummary}
Frame for this person: ${framing}
The other person works on: ${otherWork ?? "unknown"}

Format (exactly two lines):
"[Specific one-sentence reason you two should talk].
A good place to start: [concrete first question or topic]."

Be specific and concrete. No generic greetings. No filler words. Maximum 2 sentences.`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type === "text") return text.text;
  return `${ctx.overlapSummary}\n\n${framing}`;
}

export async function createChatWithOpeningMessages(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agentA: { include: { owner: true, context: true } },
      agentB: { include: { owner: true, context: true } },
    },
  });

  if (!match) throw new Error(`Match not found: ${matchId}`);

  const ctx: MatchContext = {
    overlapSummary: match.overlapSummary,
    framingForA: match.framingForA,
    framingForB: match.framingForB,
    ownerA: {
      name: match.agentA.owner.name,
      currentWork: match.agentA.context?.currentWork ?? null,
      expertise: match.agentA.context?.expertise ?? [],
    },
    ownerB: {
      name: match.agentB.owner.name,
      currentWork: match.agentB.context?.currentWork ?? null,
      expertise: match.agentB.context?.expertise ?? [],
    },
  };

  let messageA: string;
  let messageB: string;
  try {
    [messageA, messageB] = await Promise.all([
      generateOpeningMessage(ctx, "A"),
      generateOpeningMessage(ctx, "B"),
    ]);
  } catch (err) {
    console.error("[chat] Anthropic API failed, using fallback:", err);
    messageA = `Here's why you should talk: ${ctx.overlapSummary}\n\n${ctx.framingForA}`;
    messageB = `Here's why you should talk: ${ctx.overlapSummary}\n\n${ctx.framingForB}`;
  }

  const chat = await prisma.chat.create({
    data: {
      matchId,
      messages: {
        createMany: {
          data: [
            { fromOwner: "agent_a", content: messageA },
            { fromOwner: "agent_b", content: messageB },
          ],
        },
      },
    },
  });

  return chat;
}
