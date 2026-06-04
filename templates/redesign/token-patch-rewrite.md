User token-level update request:
{{originalPrompt}}

DESIGN.md has been patched in place for these roles only: {{appliedRoles}}.
All other roles (vibe, typography, spacing, radius, shadow, components, layout, responsive) remain unchanged. The DESIGN.md hash has changed because token values changed.

Task: update only the storefront UI surfaces that read the patched roles, so they reflect the new token values via tailwind config / CSS variables / token mapping.

Validation scope: changed-files (only affected UI surfaces).
Scope constraint: do NOT validate or modify unrelated storefront surfaces.

1. Call project_read_design_rules to load the new DESIGN.md.
2. Refresh token mapping in src/styles/app.css when patched roles map to CSS variables.
3. Inspect existing UI files; identify references to the patched roles only.
4. Apply minimal patches; do NOT regenerate unrelated styles or sections.
5. Run project_run_validation after mutations; repair on failure.
