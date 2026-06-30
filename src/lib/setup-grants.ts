import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const SETUP_GRANT_TTL_MS = 10 * 60 * 1000;

function hashGrant(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSetupGrant(agentId: string) {
  const token = `setup_${crypto.randomBytes(32).toString("hex")}`;
  await prisma.$transaction([
    prisma.setupGrant.updateMany({
      where: { agentId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.setupGrant.create({
      data: {
        tokenHash: hashGrant(token),
        agentId,
        expiresAt: new Date(Date.now() + SETUP_GRANT_TTL_MS),
      },
    }),
  ]);
  return token;
}

export async function consumeSetupGrant(token: string, expectedAgentId: string) {
  const rows = await prisma.$queryRaw<Array<{ agent_id: string }>>`
    UPDATE setup_grants
    SET used_at = NOW()
    WHERE token_hash = ${hashGrant(token)}
      AND agent_id = ${expectedAgentId}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING agent_id
  `;
  return rows.length === 1;
}
