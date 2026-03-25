import { z } from "zod";

export const SendMessageSchema = z.object({
  matchId: z.string().min(1).max(50),
  content: z.string().min(1, "Message cannot be empty").max(5000, "Message too long (max 5000 chars)"),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
