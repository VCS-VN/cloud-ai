User redesign request:
{{originalPrompt}}{{tokenHints}}

Task: redesign the storefront. You author DESIGN.md yourself, then rewrite the UI to match it.

Validation scope: full-storefront (all customer-facing UI must comply with the new DESIGN.md).

1. FIRST read the anti-slop design taste skill from the inline <design_taste_skill> block in the system prompt — it is the authoritative UI taste guide. There is no project_read_taste_skill tool.
2. REWRITE DESIGN.md via apply_patch: a new visual identity (palette as 15 hex color tokens in the YAML front-matter, typography, components, layout) driven by the skill and the request above. Honor any user-specified token values listed above. This file is the source of truth.
3. After writing DESIGN.md, the app.css token region is refreshed automatically by the runtime. Re-read your own DESIGN.md via shell (e.g. `cat DESIGN.md`) if you need to confirm the values.
4. Inspect existing UI files via shell (`rg --files src`, `cat <path>`) before patching.
5. Update the storefront UI so it matches DESIGN.md (palette, typography, spacing, radii, components, layout): tailwind.config.ts, src/styles/* (if present), and the storefront components/routes. Use minimal apply_patch calls per file.
6. Do NOT modify: src/data/** (product/category/sample-store data), src/app/cart-provider.tsx and state management, src/app/store-provider.tsx, package.json dependencies, route structure (only update className when strictly needed).
7. End the turn after patches; the runtime runs full-storefront validation automatically and reports any remaining errors in a follow-up turn for repair.
