User token-level update request:
{{originalPrompt}}

DESIGN.md has been patched in place for these roles only: {{appliedRoles}}.
All other roles (vibe, typography, spacing, radius, shadow, components, layout, responsive) remain unchanged. The DESIGN.md hash has changed because token values changed.

Task: update only the storefront UI surfaces that read the patched roles, so they reflect the new token values via tailwind config / CSS variables / token mapping.

Validation scope: changed-files (only affected UI surfaces).
Scope constraint: do NOT validate or modify unrelated storefront surfaces.

1. Read the new DESIGN.md via shell (e.g. `cat DESIGN.md`).
2. Refresh token mapping in src/styles/app.css via apply_patch when patched roles map to CSS variables.
3. Inspect existing UI files via shell (`rg "primary|accent|highlight" src/components src/routes`); identify references to the patched roles only.
4. Apply minimal patches via apply_patch; do NOT regenerate unrelated styles or sections.
5. End the turn after patches; the runtime runs changed-files validation automatically and reports any remaining errors in a follow-up turn for repair.
