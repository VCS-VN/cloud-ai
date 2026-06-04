---
rule: ui-design
---
# Storefront UI And Design Rules

- This is always a retail e-commerce storefront that sells products.
- DESIGN.md is a project-specific reference template for palette roles, typography, layout, and tone.
- The design taste skill is the primary guide for UI quality, polish, layout, and anti-generic design decisions.
- Generated storefronts default to light theme. Do not follow the browser or OS dark preference on first load.
- The manual theme toggle may enable dark mode, and that explicit choice is stored in localStorage key `storefront-theme`.
- Use semantic token utilities such as `bg-primary`, `text-foreground`, `bg-card`, `border-border`, and `bg-deep` when they fit the role.
- Product/category visuals should use real product images when available.
- If product images are missing, use stable seeded real photographic placeholders, not gray boxes or generic gradients.
- Product cards link to product detail; product detail is the only product surface that mutates cart state.
- Plumbing (providers, hooks, route shells, loading bar, not-found) is pre-wired at init; you own layout chrome and page sections via the design taste skill.
- Build header (brand/search/cart), footer, and route content to match DESIGN.md — no fixed section layout is pre-seeded.

## Customer-facing copy

- Strings in `src/routes/**` and `src/components/**` are shopper-facing. Write retail-neutral copy only.
- Never show builder or agent jargon in UI: no "taste skill", "route shell", "thin shell", "design taste", debug shell lines (`Shell — q=…`), or "Build … using the design …" placeholders.
- Home and `/products` must display the catalog through `useProductsList` (sample data is pre-seeded in hooks — do not import `@/data/products` in routes).
