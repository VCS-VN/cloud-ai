---
prompt: init-recovery-vertical-guidance
---
=== VERTICAL LAYOUT CONTRACT (industry skeleton) ===
{{verticalLayoutSummary}}

CREATIVE MANDATE:
- You MUST vary homepage structure and component shapes to match this vertical — not only CSS colors.
- The design-taste-frontend skill is preloaded inline in the system prompt (see the <design_taste_skill> block). AUTHOR DESIGN.md first (full 8 sections + YAML palette) by writing the file (`cat > DESIGN.md <<'EOF'` … `EOF`); refer back to the inlined taste-skill content for visual decisions. There is no project_read_design_rules tool — use shell with cat to read DESIGN.md after it exists.
- Implement block variants using the `shape` descriptions from blocks.json when present in context; otherwise follow variant ids below.
- Within this vertical you have creative freedom for copy, imagery, micro-layout, and motion — stay inside allowed variants and commerce contracts.

Required optional homepage blocks: {{requiredOptionalSlots}}
Strongly prefer optional blocks: {{preferredOptionalSlots}}
Forbidden blocks for this vertical: {{forbiddenSlots}}

Allowed variant ids per block:
{{variantLines}}

Override policy: if the user explicitly requests a layout outside this vertical, explain the tradeoff and ask before removing forbidden blocks.
=== END VERTICAL LAYOUT CONTRACT ===
