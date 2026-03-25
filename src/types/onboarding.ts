import { z } from "zod";
import { NetworkingGoal } from "./context";

export const OnboardingSchema = z.object({
  networkingGoal: NetworkingGoal,
  privacyConsent: z.boolean().refine((v) => v === true, {
    message: "Privacy consent is required to use Gennety",
  }),
  researchConsent: z.boolean().optional(),
  excludedTopics: z.array(z.string().max(100)).max(20).optional(),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;
