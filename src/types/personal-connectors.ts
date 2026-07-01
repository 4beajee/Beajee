import { z } from "zod";

export const PersonalConnectorType = z.literal("CALENDAR");
export type PersonalConnectorType = z.infer<typeof PersonalConnectorType>;

const CalendarEventSchema = z.record(z.string().max(100), z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 8_000,
  "Calendar event is too large"
);

export const PersonalConnectorConfigSchema = z.object({
  provider: z.enum(["google"]).optional(),
  calendarId: z.string().trim().min(1).max(500).optional(),
  icsUrl: z.string().trim().url().max(2_048).optional(),
  events: z.array(CalendarEventSchema).max(100).optional(),
}).strict().refine(
  (value) => JSON.stringify(value).length <= 64_000,
  "Connector config is too large"
).default({});
export type PersonalConnectorConfig = z.infer<typeof PersonalConnectorConfigSchema>;

export const PersonalConnectorUpsertSchema = z.object({
  type: PersonalConnectorType,
  enabled: z.boolean().default(true),
  token: z.string().min(1).max(10_000).optional(),
  clearToken: z.boolean().optional(),
  config: PersonalConnectorConfigSchema.optional(),
});
export type PersonalConnectorUpsertInput = z.infer<typeof PersonalConnectorUpsertSchema>;
