# Contract: Managed Project DESIGN.md

## Purpose

Defines the required observable structure of a managed retail storefront design file.

## Required File Contract

- File path: project workspace root `DESIGN.md`.
- File is present before customer-facing storefront UI generation.
- File begins with a managed generated notice telling users not to edit manually and to request design changes through chat.
- File contains structured metadata and token values.
- File contains prose sections 1 through 8 with fixed headings.

## Structured Metadata Contract

The design file exposes these design-intent fields:

- `category`
- `audience`
- `priceTier`
- `archetype`
- `mood`
- `seed`
- `source`

The design file does not expose the raw user prompt.

## Token Contract

Each token entry contains:

- `value`: concrete visual value
- `provenance`: one of `user`, `agent`, `fallback-agent`, `system`
- `role`: plain-language usage role

Required Phase 1 color tokens:

- `primary`
- `primary-foreground`
- `accent`
- `accent-foreground`
- `highlight`
- `highlight-foreground`
- `background`
- `surface`
- `surface-muted`
- `foreground`
- `muted-foreground`
- `border`
- `success`
- `warning`
- `error`

Additional token groups use stable Phase 1 role names for typography, spacing, radius, shadows, and storefront component treatments.

## Section Contract

The following headings are required:

1. `Visual Theme & Atmosphere`
2. `Color Palette & Roles`
3. `Typography Rules`
4. `Spacing System`
5. `Radius, Shadow & Motion`
6. `Component Styling`
7. `Layout Principles`
8. `Responsive Behavior`

Section 1 includes the rationale for inferred category, audience, price tier, archetype, mood, project distinction, and what visual approaches must not be used.

## Validation Contract

A design file is acceptable only when:

- Structured metadata is parseable.
- Required intent fields are present.
- Required token keys are present.
- No extra Phase 1 token keys are present.
- Every token has a value.
- Required sections are present.
- Critical color pairs meet 4.5:1 contrast.
- Muted foreground contrast warnings are reported when below 3:1.
