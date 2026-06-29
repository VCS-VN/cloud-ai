---
rule: canonical-ui-tokens
---
UI TOKEN & STYLING RULES:

SHADCN PRIMITIVES:
- `src/components/ui/*` primitives are pre-seeded and runtime-owned. Do NOT rewrite them. Do NOT override their built-in variants with broad raw background/text classes.
- Compose Button/Input/Select/Sheet/Dialog/Card/Badge with their `variant`/`size` props plus semantic token classes (`bg-card`, `bg-popover`, `text-popover-foreground`, `border-border`, `ring-ring`). Extra classes should mainly control layout, spacing, sizing, and focus rings.

OPAQUE OVERLAY PANELS:
- Every dropdown, autocomplete suggestion, menu, popover, dialog, and sheet panel MUST use an opaque surface token (`bg-popover text-popover-foreground` OR `bg-card text-card-foreground`) with `border-border`, a shadow, and sufficient z-index.
- NEVER use `bg-transparent`, `bg-background/..`, `backdrop-blur`, `mix-blend-*`, `isolation-auto`, `opacity-*` on the panel container, or nested conflicting backgrounds that let page content show through controls.
- Highlight spans inside suggestion rows use TEXT color only (`text-primary` or `text-highlight-foreground`) — never a background. Row hover/active state belongs on the row via `bg-accent text-accent-foreground`.

TAILWIND V3 `@apply`:
- `@apply` may only chain CONCRETE style utilities. Never write `@apply group`, `@apply peer`, `@apply group-hover:*`, `@apply peer-hover:*`, `@apply group-focus:*`, or any `group-*` / `peer-*` marker/variant utility in `src/styles/app.css` or other CSS.
- `group` / `peer` belong directly on the JSX element's `className`; descendant state variants (`group-hover:*`, `peer-*`) belong in descendant JSX classes. If CSS is required, write a normal selector instead of applying Tailwind marker utilities.

LUCIDE ICONS:
- Do NOT import brand/social icons from `lucide-react`: forbidden imports include `Instagram`, `Facebook`, `Twitter`, `X`, `LinkedIn`, `YouTube`, `TikTok`, `WhatsApp`, `Pinterest`, `Snapchat`, `Reddit`, `Discord`, `Telegram`. `lucide-react@1.14.0` may not export these and the build fails or shows fallback glyphs.
- For social/contact links use generic icons known to exist: `Mail`, `MessageCircle`, `Send`, `Globe`, `ExternalLink`, `MapPin`, `Phone`, or text labels.
