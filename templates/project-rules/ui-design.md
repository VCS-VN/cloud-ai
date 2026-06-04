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
- Header includes brand/search/cart affordance. Footer and loading/not-found states remain storefront-branded.
