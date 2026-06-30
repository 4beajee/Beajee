import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const TOKEN_EXPIRY_SECONDS = 3600;

function tokenHash(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function createOAuthToken(
  agentInternalId: string,
  agentExternalId: string,
  credentialVersion: number
) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: tokenHash(rawToken),
      agentId: agentInternalId,
      credentialVersion,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000),
    },
  });
  return {
    access_token: rawToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    agent_id: agentExternalId,
  };
}

export async function validateOAuthToken(rawToken: string) {
  const record = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash: tokenHash(rawToken) },
    include: { agent: { select: { agentId: true, credentialVersion: true } } },
  });
  if (
    !record ||
    record.revokedAt ||
    record.expiresAt <= new Date() ||
    record.credentialVersion !== record.agent.credentialVersion
  ) {
    return null;
  }
  return { agentInternalId: record.agentId, agentExternalId: record.agent.agentId };
}

export async function revokeOAuthTokensForAgent(agentId: string) {
  return prisma.oAuthAccessToken.updateMany({
    where: { agentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
