User redesign request:
{{originalPrompt}}{{tokenHints}}

Task: redesign the storefront. You author DESIGN.md yourself, then rewrite the UI to match it.

Validation scope: full-storefront (all customer-facing UI must comply with the new DESIGN.md).

1. FIRST call project_read_taste_skill (the anti-slop design skill) to load the authoritative UI taste guide.
2. REWRITE DESIGN.md via project_create_file: a new visual identity (palette as 15 hex color tokens in the YAML front-matter, typography, components, layout) driven by the skill and the request above. Honor any user-specified token values listed above. This file is the source of truth.
3. Call project_read_design_rules to load the DESIGN.md you just wrote (this is required before any UI mutation). The app.css token region is refreshed automatically when you write DESIGN.md.
4. Inspect existing UI files with project_get_file_tree and project_read_file before patching.
5. Update the storefront UI so it matches DESIGN.md (palette, typography, spacing, radii, components, layout): tailwind.config.ts, src/styles/* (if present), and the storefront components/routes. Use minimal patches per file.
6. Do NOT modify: src/data/** (product/category/sample-store data), src/app/cart-provider.tsx and state management, src/app/store-provider.tsx, package.json dependencies, route structure (only update className when strictly needed).
7. Run project_run_validation after mutations; repair on failure. Validate full storefront compliance with the new DESIGN.md before completion.
