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
- Tailwind CSS v3 `@apply` may be used only with real style utilities. Never use `@apply group`, `@apply peer`, `@apply group-hover:*`, `@apply peer-hover:*`, `@apply group-focus:*`, or any `group-*` / `peer-*` marker/variant utility in CSS. Put `group` or `peer` directly on the JSX element's `className`, then use `group-hover:*` / `peer-*` variants in descendant JSX classes, or write a plain CSS selector instead.
- Shadcn UI primitives under `src/components/ui/*` are runtime-owned. Do not rewrite them, and do not fight their built-in variants with broad background/text overrides. When using primitives such as `Button`, `Input`, `Select`, `Sheet`, `Dialog`, `Card`, or `Badge`, prefer their `variant`/`size` props and token classes. If extra styling is needed, only add layout/spacing/sizing/ring classes or semantic token classes that preserve contrast.
- Popovers, suggestion dropdowns, dialogs, sheets, menus, and autocomplete panels must use an opaque surface token (`bg-popover text-popover-foreground` or `bg-card text-card-foreground`) plus `border-border` and an appropriate shadow. Never use transparent, `bg-background/..`, `backdrop-blur`, `mix-blend-*`, `isolation-auto`, `opacity-*` on the panel container, or nested conflicting backgrounds that let page content visually cross through the overlay.
- Search suggestion rows should be plain buttons/listbox options on the popover surface: `bg-transparent` by default, `hover:bg-accent hover:text-accent-foreground`, and match highlight text tinted with `text-primary` only. Do not put a background on highlight spans.
- Product/category visuals should use real product images when available.
- If product images are missing, use stable seeded real photographic placeholders, not gray boxes or generic gradients.
- Product cards link to product detail; product detail is the only product surface that mutates cart state.
- Plumbing (providers, hooks, route shells, loading bar, not-found) is pre-wired at init; you own layout chrome and page sections via the design taste skill.
- Build header (brand/search/cart), footer, and route content to match DESIGN.md — no fixed section layout is pre-seeded.
- Product detail routes must avoid render-loop patterns: derive `images`, `modelOptions`, `selectedModel`, `selectedPrice`, and sanitized HTML with `useMemo`; do not use `useEffect` to copy product data into state or to set selected model/image based on `product`, `product.models`, `product.images`, or derived arrays. User-event state (`selectedImageIndex`, `selectedModelId`, `quantity`, sheet open/read-more toggles) may use `useState`, and derived objects should be computed from IDs and memoized arrays during render. Do not preselect a product model; selecting a model should sync the quantity input from the cart when that model already exists.

## Customer-facing copy

- Strings in `src/routes/**` and `src/components/**` are shopper-facing. Write retail-neutral copy only.
- Never show builder or agent jargon in UI: no "taste skill", "route shell", "thin shell", "design taste", debug shell lines (`Shell — q=…`), or "Build … using the design …" placeholders.
- Home and `/products` must display the catalog through `useProductsList` (sample data is pre-seeded in hooks — do not import `@/data/products` in routes).
