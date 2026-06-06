import type { VerticalLayoutSpec } from "../design/vertical-layout-spec.schema";
import { formatVerticalLayoutSummary } from "../design/vertical-layout-spec.server";
import { renderPromptDoc } from "./prompt-template-store.server";

const VERTICAL_INIT_GUIDANCE_PROMPT =
  "templates/codex-builder/recovery/vertical-guidance.md";

/**
 * Injects vertical-specific layout guidance into the retail init prompt so the
 * coder agent varies structure (not only palette) per industry template.
 */
export function buildVerticalInitGuidance(vertical: VerticalLayoutSpec): string {
  const required = vertical.homepage.requiredOptionalSlots.join(", ") || "none";
  const preferred = vertical.homepage.preferredOptionalSlots.join(", ") || "none";
  const forbidden = vertical.homepage.forbiddenSlots.join(", ") || "none";

  const variantLines = Object.entries(vertical.blocks)
    .map(
      ([blockId, cfg]) =>
        `  - ${blockId}: pick one of [${cfg.allowedVariants.join(", ")}] (default ${cfg.defaultVariant ?? cfg.allowedVariants[0]})`,
    )
    .join("\n");

  return (
    "\n" +
    renderPromptDoc(VERTICAL_INIT_GUIDANCE_PROMPT, {
      verticalLayoutSummary: formatVerticalLayoutSummary(vertical),
      requiredOptionalSlots: required,
      preferredOptionalSlots: preferred,
      forbiddenSlots: forbidden,
      variantLines,
    })
  );
}
