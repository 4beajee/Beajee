import crypto from "crypto";

// In-memory OAuth token store for client_credentials flow.
// Production should use Redis or DB for multi-instance deployments.

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

interface TokenEntry {
  agentInternalId: string;
  agentExternalId: string;
  expiresAt: number;
}

const tokenStore = new Map<string, TokenEntry>();

export function createOAuthToken(agentInternalId: string, agentExternalId: string): {
  access_token: string;
  token_type: string;
  expires_in: number;
} {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = Date.now() + TOKEN_EXPIRY_SECONDS * 1000;

  tokenStore.set(hashedToken, { agentInternalId, agentExternalId, expiresAt });

  // Clean up expired tokens periodically
  if (tokenStore.size > 100) {
    const now = Date.now();
    for (const [key, val] of tokenStore) {
      if (val.expiresAt < now) tokenStore.delete(key);
    }
  }

  return {
    access_token: rawToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
  };
}

export function validateOAuthToken(rawToken: string): { agentInternalId: string; agentExternalId: string } | null {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const entry = tokenStore.get(hashedToken);

  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    tokenStore.delete(hashedToken);
    return null;
  }

  return { agentInternalId: entry.agentInternalId, agentExternalId: entry.agentExternalId };
}
