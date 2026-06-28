import { z } from "zod";

export const PersonalConnectorType = z.literal("CALENDAR");
export type PersonalConnectorType = z.infer<typeof PersonalConnectorType>;

export const PersonalConnectorConfigSchema = z.record(z.string(), z.unknown()).default({});
export type PersonalConnectorConfig = z.infer<typeof PersonalConnectorConfigSchema>;

export const PersonalConnectorUpsertSchema = z.object({
  type: PersonalConnectorType,
  enabled: z.boolean().default(true),
  token: z.string().min(1).max(10_000).optional(),
  clearToken: z.boolean().optional(),
  config: PersonalConnectorConfigSchema.optional(),
});
export type PersonalConnectorUpsertInput = z.infer<typeof PersonalConnectorUpsertSchema>;
