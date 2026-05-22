# Contract: Storefront UI Design Compliance

## Purpose

Defines when customer-facing storefront UI changes are accepted or blocked by project design rules.

## UI Mutation Gate

A customer-facing UI change is accepted only if project design rules have been loaded during the same run.

Customer-facing UI scope includes:

- Storefront components
- Storefront routes/pages
- Storefront style files
- Storefront app layout files
- Visual theme configuration
- Visual assets such as logo, icon, and style assets

Excluded scope includes:

- Store data files
- Server-only files
- Internal tooling
- Admin interfaces
- Tests that do not mutate storefront UI
- Non-visual package or project configuration

## Allowed Visual Usage

Changed customer-facing UI files may use:

- Approved semantic token utilities derived from the project design rules.
- Structural layout utilities that do not introduce visual token values.
- State variants and opacity modifiers applied to approved token utilities.
- SVG current-color behavior when no hardcoded visual color is introduced.

## Disallowed Visual Usage

Changed customer-facing UI files must not introduce:

- Raw color values.
- Arbitrary visual utility values.
- Palette utilities outside the approved token utility set.
- Inline styles for color, background, border radius, shadow, or font family.
- Raw font family strings.
- Raw shadow values.

## Validation Scope

- Normal feature, text, and local component-fit updates validate changed customer-facing UI files.
- Initialization, identity-level redesign, and explicit design synchronization validate the full customer-facing storefront.
- Shared components that affect many storefront surfaces should be validated together with direct usage when practical.

## Failure Contract

A failed validation must identify:

- The file or scoped location.
- The disallowed or invalid visual value.
- The reason it violates project design rules.
- The expected repair direction, such as using a mapped token utility.
