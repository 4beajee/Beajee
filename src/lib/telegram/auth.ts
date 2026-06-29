import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getTelegramBotToken } from "@/lib/telegram/bot";

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const TELEGRAM_JWT_TTL_SECONDS = 7 * 24 * 60 * 60;

export class TelegramAuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401
  ) {
    super(message);
  }
}

export interface TelegramWebAppUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface VerifiedTelegramInitData {
  telegramId: string;
  authDate: Date;
  queryId: string | null;
  startParam: string | null;
  user: TelegramWebAppUser;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function timingSafeHexEqual(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getJwtSecret() {
  const secret =
    process.env.TELEGRAM_JWT_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "";

  if (!secret) {
    throw new TelegramAuthError("JWT secret is not configured", 500);
  }

  return secret;
}

function displayNameFromTelegramUser(user: TelegramWebAppUser) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || (user.username ? `@${user.username}` : `Telegram ${String(user.id)}`);
}

export function redactTelegramSecrets(value: unknown) {
  const token = getTelegramBotToken();
  let text = typeof value === "string" ? value : JSON.stringify(value);

  if (token) {
    text = text.replaceAll(token, "[telegram-token]");
  }

  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[jwt]");
}

export function verifyInitData(
  initData: string,
  options?: {
    botToken?: string;
    maxAgeSeconds?: number;
    now?: Date;
  }
): VerifiedTelegramInitData {
  if (!initData || typeof initData !== "string") {
    throw new TelegramAuthError("initData is required", 400);
  }

  const botToken = options?.botToken ?? getTelegramBotToken();
  if (!botToken) {
    throw new TelegramAuthError("TELEGRAM_BOT_TOKEN is not configured", 500);
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    throw new TelegramAuthError("Telegram initData hash is missing", 401);
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeHexEqual(expectedHash, receivedHash)) {
    throw new TelegramAuthError("Telegram initData signature is invalid", 401);
  }

  const authDateRaw = params.get("auth_date");
  const authDateSeconds = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDateSeconds)) {
    throw new TelegramAuthError("Telegram auth_date is invalid", 401);
  }

  const nowMs = options?.now?.getTime() ?? Date.now();
  const authDateMs = authDateSeconds * 1000;
  const maxAgeSeconds = options?.maxAgeSeconds ?? DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
  if (Math.abs(nowMs - authDateMs) > maxAgeSeconds * 1000) {
    throw new TelegramAuthError("Telegram initData is expired", 401);
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new TelegramAuthError("Telegram user payload is missing", 401);
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw new TelegramAuthError("Telegram user payload is invalid", 401);
  }

  if (!user?.id) {
    throw new TelegramAuthError("Telegram user id is missing", 401);
  }

  return {
    telegramId: String(user.id),
    authDate: new Date(authDateMs),
    queryId: params.get("query_id"),
    startParam: params.get("start_param"),
    user,
  };
}

export async function issueUnifiedToken(verified: VerifiedTelegramInitData) {
  const owner = await prisma.owner.upsert({
    where: { telegramId: verified.telegramId },
    update: {
      name: displayNameFromTelegramUser(verified.user),
      image: verified.user.photo_url ?? undefined,
    },
    create: {
      telegramId: verified.telegramId,
      email: `telegram-${verified.telegramId}@telegram.beajee.local`,
      name: displayNameFromTelegramUser(verified.user),
      image: verified.user.photo_url,
      emailVerified: new Date(),
      onboarded: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      onboarded: true,
      telegramId: true,
      schedulingUrl: true,
    },
  });

  return issueOwnerToken(owner, verified.telegramId);
}

type TokenOwner = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  onboarded: boolean;
  telegramId: string | null;
  schedulingUrl: string | null;
};

function issueOwnerToken(owner: TokenOwner, telegramId: string | null) {

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "beajee",
    aud: "beajee.telegram-mini-app",
    sub: owner.id,
    ownerId: owner.id,
    telegramId,
    iat: now,
    exp: now + TELEGRAM_JWT_TTL_SECONDS,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(unsigned).digest();

  return {
    token: `${unsigned}.${base64Url(signature)}`,
    expiresAt: new Date(payload.exp * 1000),
    owner,
  };
}

export async function issueUnifiedTokenForOwner(ownerId: string) {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      onboarded: true,
      telegramId: true,
      schedulingUrl: true,
    },
  });
  if (!owner) throw new TelegramAuthError("Owner not found", 404);
  return issueOwnerToken(owner, owner.telegramId);
}

export function verifyUnifiedToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new TelegramAuthError("Telegram session token is invalid", 401);
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const unsigned = `${headerPart}.${payloadPart}`;
  const expected = crypto.createHmac("sha256", getJwtSecret()).update(unsigned).digest();
  const actual = Buffer.from(signaturePart.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new TelegramAuthError("Telegram session token signature is invalid", 401);
  }

  let payload: {
    aud?: string;
    ownerId?: string;
    exp?: number;
  };
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    throw new TelegramAuthError("Telegram session token payload is invalid", 401);
  }

  if (payload.aud !== "beajee.telegram-mini-app" || !payload.ownerId) {
    throw new TelegramAuthError("Telegram session token audience is invalid", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new TelegramAuthError("Telegram session token is expired", 401);
  }

  return {
    ownerId: payload.ownerId,
    expiresAt: new Date(payload.exp * 1000),
  };
}

export const __test = {
  DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
  TELEGRAM_JWT_TTL_SECONDS,
  base64Url,
};
