import type { VerticalLayoutSpec } from "../design/vertical-layout-spec.schema";
import { formatVerticalLayoutSummary } from "../design/vertical-layout-spec.server";

/**
 * Injects vertical-specific layout guidance into the retail init prompt so the
 * coder agent varies structure (not only palette) per industry template.
 */
export function buildVerticalInitGuidance(vertical: VerticalLayoutSpec): string {
  const required = vertical.homepage.requiredOptionalSlots.join(", ") || "none";
  const preferred = vertical.homepage.preferredOptionalSlots.join(", ") || "none";
  const forbidden = vertical.homepage.forbiddenSlots.join(", ") || "none";

  const variantLines = Object.entries(vertical.blocks)
    .map(([blockId, cfg]) => `  - ${blockId}: pick one of [${cfg.allowedVariants.join(", ")}] (default ${cfg.defaultVariant ?? cfg.allowedVariants[0]})`)
    .join("\n");

  return [
    "",
    "=== VERTICAL LAYOUT CONTRACT (industry skeleton) ===",
    formatVerticalLayoutSummary(vertical),
    "",
    "CREATIVE MANDATE:",
    "- You MUST vary homepage structure and component shapes to match this vertical — not only CSS colors.",
    "- The design-taste-frontend skill is preloaded server-side for this init run (see prior developer message). AUTHOR DESIGN.md first (full 8 sections + YAML palette), then project_read_design_rules.",
    "- Implement block variants using the `shape` descriptions from blocks.json when present in context; otherwise follow variant ids below.",
    "- Within this vertical you have creative freedom for copy, imagery, micro-layout, and motion — stay inside allowed variants and commerce contracts.",
    "",
    `Required optional homepage blocks: ${required}`,
    `Strongly prefer optional blocks: ${preferred}`,
    `Forbidden blocks for this vertical: ${forbidden}`,
    "",
    "Allowed variant ids per block:",
    variantLines,
    "",
    "Override policy: if the user explicitly requests a layout outside this vertical, explain the tradeoff and ask before removing forbidden blocks.",
    "=== END VERTICAL LAYOUT CONTRACT ===",
  ].join("\n");
}
