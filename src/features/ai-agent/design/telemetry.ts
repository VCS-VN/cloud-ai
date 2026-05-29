import { z } from "zod";

const SLUG_REGEX = /^[a-z][a-z0-9-]*$/;

export const DesignGeneratedEventSchema = z.object({
  type: z.literal("design_generated"),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  intent: z.enum(["init", "redesign", "shake_design"]),
  vibe: z.object({
    descriptor: z.string().min(1).max(200),
    anchors: z.array(z.string().regex(SLUG_REGEX)).min(1).max(2),
  }),
  category: z.object({
    primary: z.string().min(1),
    subcategory: z.string().min(1).nullable(),
  }),
  variantChoices: z
    .array(
      z.object({
        blockId: z.string().regex(SLUG_REGEX),
        variantId: z.string().regex(SLUG_REGEX),
        tier: z.enum(["high-impact", "supporting"]),
      }),
    )
    .min(1),
  designVersion: z.number().int().min(1),
  shakeRevision: z.number().int().min(0),
  generatedAt: z.string().datetime(),
});

export type DesignGeneratedEvent = z.infer<typeof DesignGeneratedEventSchema>;

const safeStringify = (event: DesignGeneratedEvent): string => {
  try {
    return JSON.stringify(event);
  } catch {
    return JSON.stringify({
      type: event.type,
      projectId: event.projectId,
      intent: event.intent,
      generatedAt: event.generatedAt,
      _serializeError: true,
    });
  }
};

export async function emitDesignGenerated(event: DesignGeneratedEvent): Promise<void> {
  try {
    const parsed = DesignGeneratedEventSchema.parse(event);
    // eslint-disable-next-line no-console
    console.info(safeStringify(parsed));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[telemetry] design_generated emit failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}
