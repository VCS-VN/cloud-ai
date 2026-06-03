import { z } from "zod";

export const VerticalBlockConfigSchema = z.object({
  allowedVariants: z.array(z.string()).min(1),
  defaultVariant: z.string().optional(),
});

export const VerticalLayoutSpecSchema = z.object({
  templateId: z.string(),
  verticalLabel: z.string(),
  storeTypes: z.array(z.string()).min(1),
  homepage: z.object({
    rhythm: z.string(),
    preferredOptionalSlots: z.array(z.string()).default([]),
    requiredOptionalSlots: z.array(z.string()).default([]),
    forbiddenSlots: z.array(z.string()).default([]),
    preferredSocialProofBlocks: z.array(z.string()).optional(),
  }),
  blocks: z.record(z.string(), VerticalBlockConfigSchema),
  overrides: z
    .object({
      allowUserOverride: z.boolean().default(true),
      maxSlotRemovals: z.number().int().min(0).default(1),
      maxSlotAdditions: z.number().int().min(0).default(1),
    })
    .default({
      allowUserOverride: true,
      maxSlotRemovals: 1,
      maxSlotAdditions: 1,
    }),
});

export type VerticalLayoutSpec = z.infer<typeof VerticalLayoutSpecSchema>;
export type VerticalBlockConfig = z.infer<typeof VerticalBlockConfigSchema>;
