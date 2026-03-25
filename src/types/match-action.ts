import { z } from "zod";

export const MatchActionSchema = z.object({
  matchId: z.string().min(1).max(50),
  action: z.enum(["confirm", "dormant"]),
});

export type MatchActionInput = z.infer<typeof MatchActionSchema>;
