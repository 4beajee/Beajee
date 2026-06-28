import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getTelegramBotUsername } from "@/lib/telegram/bot";

const LINK_TTL_MS = 15 * 60 * 1000;
const LINK_PREFIX = "telegram-link:";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function placeholderEmail(telegramId: string) {
  return `telegram-${telegramId}@telegram.beajee.local`;
}

export async function createTelegramLink(ownerId: string) {
  const botUsername = getTelegramBotUsername();
  if (!botUsername) throw new Error("TELEGRAM_BOT_USERNAME is not configured");

  const rawToken = crypto.randomBytes(24).toString("base64url");
  const token = hashToken(rawToken);
  const identifier = `${LINK_PREFIX}${ownerId}`;
  const expires = new Date(Date.now() + LINK_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token, expires } }),
  ]);

  return {
    expiresAt: expires,
    url: `https://t.me/${botUsername}?start=sync_${rawToken}`,
  };
}

export async function consumeTelegramLink(args: {
  rawToken: string;
  telegramId: string;
  name: string;
  image?: string | null;
}) {
  const token = hashToken(args.rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith(LINK_PREFIX)) {
    throw new Error("This Telegram sync link is invalid or already used");
  }
  if (record.expires.getTime() <= Date.now()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
    throw new Error("This Telegram sync link expired. Start again from Beajee");
  }

  const ownerId = record.identifier.slice(LINK_PREFIX.length);
  return prisma.$transaction(async (tx) => {
    const [owner, linkedOwner] = await Promise.all([
      tx.owner.findUnique({ where: { id: ownerId } }),
      tx.owner.findUnique({
        where: { telegramId: args.telegramId },
        include: { agent: { select: { id: true } } },
      }),
    ]);

    if (!owner) throw new Error("Beajee account not found");
    if (linkedOwner && linkedOwner.id !== owner.id) {
      const disposablePlaceholder =
        linkedOwner.email === placeholderEmail(args.telegramId) && !linkedOwner.agent;
      if (!disposablePlaceholder) {
        throw new Error("This Telegram account is already linked to another Beajee account");
      }

      await tx.telegramTopic.updateMany({
        where: { ownerId: linkedOwner.id },
        data: { ownerId: owner.id },
      });
      await tx.owner.delete({ where: { id: linkedOwner.id } });
    }

    const updated = await tx.owner.update({
      where: { id: owner.id },
      data: {
        telegramId: args.telegramId,
        name: owner.name ?? args.name,
        image: owner.image ?? args.image ?? undefined,
        schedulingUrl: owner.schedulingUrl ?? linkedOwner?.schedulingUrl ?? undefined,
      },
      select: { id: true, telegramId: true, agentPlatform: true },
    });

    await tx.verificationToken.delete({ where: { token } });
    return updated;
  });
}

export const __test = { LINK_TTL_MS, hashToken };
