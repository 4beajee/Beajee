import { z } from "zod";
import { NetworkingGoal } from "./context";
import { SchedulingUrlSchema } from "@/lib/scheduling-url";
import { SocialProfilePatchSchema } from "@/lib/social-profile";
import { SensitiveTopicSchema } from "@/lib/sensitive-topics";

export const SettingsUpdateSchema = z
  .object({
    agentActive: z.boolean().optional(),
    excludedTopics: z.array(SensitiveTopicSchema).max(4).optional(),
    researchConsent: z.boolean().optional(),
    networkingGoal: NetworkingGoal.optional(),
    wakeWebhookEnabled: z.boolean().optional(),
    // Empty string clears the field; https URL required otherwise.
    webhookUrl: z
      .union([z.literal(""), z.string().url("Must be a valid URL").startsWith("https://", "Webhook must use HTTPS").max(500)])
      .optional(),
    webhookToken: z.union([z.literal(""), z.string().min(8).max(500)]).optional(),
    schedulingUrl: z.union([z.literal(""), SchedulingUrlSchema]).optional(),
    socialProfiles: SocialProfilePatchSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided",
  });

export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export const DeleteAccountSchema = z.object({
  confirmEmail: z.string().email("Please enter a valid email"),
});
