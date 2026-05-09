import { z } from "zod";

export const agentRequestSchema = z.object({
  projectId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  prompt: z.string().trim().min(1),
  clientRequestId: z.string().optional(),
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;
