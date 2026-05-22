# Contract: Design Change Classification

## Purpose

Defines observable behavior for later user prompts that may affect storefront design.

## Feature Or Content Update

A prompt is treated as a feature or content update when it requests behavior, copy, data display, or a local component fit change without changing the broader design identity.

Expected outcome:

- `DESIGN.md` remains unchanged.
- Only requested UI scope changes.
- Changed customer-facing UI files still validate against current design rules.

## Token-Specific Design Change

A prompt is treated as token-specific when it names or clearly implies a specific design role, such as primary color, accent color, radius, font treatment, or shadow level.

Expected outcome:

- Relevant token value changes.
- Token provenance becomes user-provided for explicit values.
- Relevant explanatory guidance updates.
- Unrelated design intent is preserved.
- Token mapping refreshes.
- Affected storefront UI validates against the changed rules.

## Identity-Level Redesign

A prompt is treated as redesign when it asks for a broad style, mood, audience, or positioning change across the storefront.

Expected outcome:

- Design intent and relevant tokens/guidance are regenerated or revised.
- Existing user-provided tokens are preserved unless the current prompt conflicts.
- Token mapping refreshes.
- Full customer-facing storefront synchronizes to the updated design rules.
- Full storefront compliance validation runs.
