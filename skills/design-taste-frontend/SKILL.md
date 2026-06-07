---
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.
aliases:
  - taste skill
  - anti-slop
triggers:
  - redesign
  - premium UI
  - storefront UI
asksClarification: true
clarificationPolicy: when_ambiguous
appliesTo:
  - init_project
  - design_update
  - ui_mutation
version: "1.0.0"
---

# Design taste — anti-slop frontend

This skill drives UI quality for storefront builds. It is the authoritative
guide for visual direction, layout discipline, and typographic hierarchy in
every retail run.

## Anti-slop principles

1. **Real photography over gradients.** Use seeded Lorem Picsum URLs
   (`https://picsum.photos/seed/<stable-seed>/<w>/<h>`) for any product or
   lifestyle image fallback. Never render decorative gradient blocks or empty
   gray placeholders standing in for product imagery.
2. **Design tokens over hex.** Use semantic tokens
   (`bg-primary`, `text-foreground`, `bg-card`, `border-border`) from the
   project's design system. Never inline hex colors in JSX or CSS modules.
3. **Hierarchy over decoration.** Type scale, spacing rhythm, and contrast do
   the heavy lifting. Decorative borders, drop shadows, and gradients are
   accents — not load-bearing structure.
4. **Brand name from state.** Always render
   `{useStore().storeDetail?.name}` for the live brand identity. Never hardcode
   placeholder names like "AI Storefront" or "Demo Store".
5. **Editorial spacing.** Generous section padding, balanced container widths,
   and consistent vertical rhythm. Avoid cramped layouts that fight the type
   scale.

## Pre-flight checklist (every UI mutation)

Before applying any UI change, verify the planned output against:

- Are colors coming from semantic tokens?
- Are images real photography (or Picsum-seeded fallbacks)?
- Is the brand name pulled from `useStore()`?
- Does the layout breathe (section padding ≥ 4rem on desktop, ≥ 2rem on mobile)?
- Are interactive states (hover, focus, active) covered?

If any answer is no, revise before writing the file.

## Pages this skill applies to

- Init: home, products, product-detail, cart, checkout, orders, order-detail
- Design updates: any in-route UI tweak
- UI mutations: small content + style edits inside existing components

## Vibe override (when user requests a specific aesthetic)

If the user prompt explicitly asks for a vibe — "dark cyberpunk", "warm
artisan", "Swiss minimal" — translate the vibe into:
1. A palette role mapping (which token plays "primary", "accent", "muted").
2. A type scale adjustment (display weight, body line-height).
3. A spacing rhythm shift (denser for cyberpunk, airier for artisan).

Never hardcode the palette in JSX — always go through the token layer so the
project's design system stays the single source of truth.
