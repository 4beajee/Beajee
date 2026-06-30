import type { PersonalConnector, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertConnectorCryptoReady,
  decryptConnectorSecret,
  encryptConnectorSecret,
} from "@/lib/connectors/personal/crypto";
import { PersonalConnectorUpsertSchema } from "@/types/personal-connectors";
import { validateExternalHttpsUrl } from "@/lib/safe-external-fetch";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

export async function listPersonalConnectors(ownerId: string) {
  const connectors = await prisma.personalConnector.findMany({
    where: { ownerId, type: "CALENDAR" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ownerId: true,
      type: true,
      enabled: true,
      config: true,
      createdAt: true,
      updatedAt: true,
      encryptedToken: true,
    },
  });

  return connectors.map((connector) => ({
    id: connector.id,
    ownerId: connector.ownerId,
    type: connector.type,
    enabled: connector.enabled,
    config: connector.config,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
    hasToken: Boolean(connector.encryptedToken),
  }));
}

export async function upsertPersonalConnector(ownerId: string, input: unknown) {
  const parsed = PersonalConnectorUpsertSchema.parse(input);
  assertConnectorCryptoReady();
  const icsUrl = parsed.config?.icsUrl;
  if (typeof icsUrl === "string" && icsUrl.trim()) {
    validateExternalHttpsUrl(icsUrl.trim());
  }

  const tokenFields =
    parsed.token !== undefined
      ? encryptConnectorSecret(parsed.token)
      : parsed.clearToken
        ? { encryptedToken: null, tokenIv: null }
        : {};

  return prisma.personalConnector.upsert({
    where: {
      ownerId_type: {
        ownerId,
        type: "CALENDAR",
      },
    },
    create: {
      ownerId,
      type: "CALENDAR",
      enabled: parsed.enabled,
      config: toInputJson(parsed.config ?? {}),
      ...tokenFields,
    },
    update: {
      enabled: parsed.enabled,
      config: toInputJson(parsed.config ?? {}),
      ...tokenFields,
    },
  });
}

export function decryptPersonalConnectorToken(
  connector: Pick<PersonalConnector, "encryptedToken" | "tokenIv">
) {
  return decryptConnectorSecret(connector);
}
