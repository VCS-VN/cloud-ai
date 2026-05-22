# Quickstart: Project Design Rules

## Goal

Verify that retail storefront projects receive diverse project-local design rules and that later UI changes stay compliant.

## Scenario 1: New Retail Project With Vague Prompt

1. Create a new retail storefront project using a broad prompt such as “create an online store”.
2. Confirm the project workspace contains root `DESIGN.md` before customer-facing UI is generated.
3. Confirm `DESIGN.md` has managed-file notice, structured design intent, fixed token roles, and sections 1 through 8.
4. Confirm Section 1 explains category, audience, price tier, archetype, mood, and visual constraints.
5. Confirm the generated storefront uses the project’s design direction.

## Scenario 2: Controlled Variety

1. Create two retail storefront projects using the same vague prompt but different project identities.
2. Compare their `DESIGN.md` files.
3. Confirm both pass design validation.
4. Confirm the design directions may differ while each remains stable when repeated for the same project and prompt.

## Scenario 3: UI Update Compliance

1. Request a customer-facing UI update on an existing project.
2. Confirm design rules are loaded before mutation is accepted.
3. Confirm changed storefront UI files contain no raw visual values or unapproved palette utilities.
4. Confirm validation reports repairable errors if violations are introduced.

## Scenario 4: Token-Specific Design Change

1. Request a specific token change such as a new primary color.
2. Confirm only the relevant token and related explanatory guidance change.
3. Confirm unrelated design intent remains stable.
4. Confirm token mapping refreshes and affected UI reflects the new token.

## Scenario 5: Identity-Level Redesign

1. Request a broad redesign such as “make the whole store feel luxury”.
2. Confirm the design intent and relevant token values update.
3. Confirm prior user-provided tokens remain unless they conflict with the redesign request.
4. Confirm the full customer-facing storefront synchronizes with the updated design rules.
5. Confirm full storefront compliance validation passes.
