# Feature Specification: Project Design Rules

**Feature Branch**: `017-project-design-rules`  
**Created**: 2026-05-23  
**Status**: Draft  
**Input**: User description: "Generate diverse retail storefront UI by creating a project-local DESIGN.md at initialization. Each project must treat its own DESIGN.md as the source of truth for UI generation and UI updates. The file uses the same fixed section structure as the storefront design template, but token values and design intent vary by user prompt, inferred retail context, audience, price tier, and deterministic project-specific variety."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize A Distinct Retail Design System (Priority: P1)

As a store owner creating a new retail storefront, I want the project to receive its own design rules before any UI is generated, so the initial storefront looks cohesive and does not feel copied from other projects.

**Why this priority**: This is the core value of the feature: every generated retail storefront starts from project-specific visual direction rather than a shared global design rule.

**Independent Test**: Create two new retail projects from the same broad prompt but different project identities, then verify each project has a valid root `DESIGN.md` with a distinct design direction and the generated storefront follows its own design rules.

**Acceptance Scenarios**:

1. **Given** a new retail project is initialized with a detailed style prompt, **When** generation begins, **Then** the project receives a root `DESIGN.md` before storefront UI is generated and the file reflects the user's explicit style choices.
2. **Given** a new retail project is initialized with a vague retail prompt, **When** generation begins, **Then** the project receives a root `DESIGN.md` with a professional design direction inferred from retail category, audience, price tier, and deterministic project-specific variety.
3. **Given** two different retail projects are initialized from the same vague prompt, **When** their design files are compared, **Then** they may use different valid visual directions while remaining stable for the same project and prompt.

---

### User Story 2 - Keep Storefront Updates Consistent With Project Design (Priority: P2)

As a store owner requesting later storefront changes, I want the agent to read and follow the project's design rules before changing customer-facing UI, so updates remain visually consistent with the established storefront identity.

**Why this priority**: A project-specific design system only creates long-term value if future UI changes continue to follow it.

**Independent Test**: Request a customer-facing UI update after initialization and verify the update is blocked unless the project design rules are loaded, then verify the changed UI uses approved design tokens rather than raw visual values.

**Acceptance Scenarios**:

1. **Given** an existing retail project with `DESIGN.md`, **When** a prompt may modify customer-facing UI, **Then** the agent must load the current project design rules before making the UI change.
2. **Given** a feature or content tweak prompt, **When** the requested change affects only a specific section or component instance, **Then** the storefront code changes minimally and `DESIGN.md` remains unchanged.
3. **Given** a changed storefront UI file contains a visual value not allowed by the project design rules, **When** validation runs, **Then** the change fails with a repairable message identifying the violation.

---

### User Story 3 - Change Storefront Design Through Managed Prompts (Priority: P3)

As a store owner, I want to change brand colors or redesign the storefront through chat prompts, so the managed design file, generated token mapping, and storefront UI stay synchronized.

**Why this priority**: Users need design evolution without manual file editing or visual drift.

**Independent Test**: Submit a token-specific prompt and a redesign prompt, then verify token-specific prompts update only relevant design rules while redesign prompts update the broader visual identity and synchronize the storefront.

**Acceptance Scenarios**:

1. **Given** a user asks to change a specific design token such as the primary color, **When** the request is processed, **Then** only the relevant token and matching design-rule explanation are updated, and the storefront reflects the new token through approved utilities.
2. **Given** a user asks for an identity-level redesign such as making the whole storefront more luxurious, **When** the request is processed, **Then** the project design direction is regenerated or revised, user-specified tokens are preserved unless they conflict, and the customer-facing storefront is synchronized with the new design rules.
3. **Given** a user wants to edit `DESIGN.md` directly, **When** they view the design rules, **Then** the file is presented as a managed read-only artifact and design changes are requested through chat instead.

### Edge Cases

- If the design generation service cannot produce an acceptable design, fallback generation still creates a deterministic, project-varied design rather than a fixed default.
- If a generated or patched design lacks required sections, required token values, or required contrast, the design is rejected with a repairable validation message.
- If a prompt is clearly a feature or text change, the design file is not changed even when the touched UI area could be visually improved.
- If a prompt is a token-specific design change, only the requested token role and directly related explanatory text are changed; unrelated design intent is preserved.
- If a prompt is an identity-level redesign, existing user-specified token choices are preserved unless the new request directly conflicts with them.
- If changed UI files use raw colors, arbitrary visual utilities, inline visual styles, raw font families, or raw shadows, validation fails.
- If legacy storefront UI contains violations outside the touched files during a normal feature update, those violations do not block the update unless they are in the changed scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a project-local `DESIGN.md` at the root of each generated retail storefront project before customer-facing UI generation begins.
- **FR-002**: System MUST limit this feature to retail storefront customer-facing UI and MUST NOT apply these design-rule requirements to admin tooling, internal preview shells, SaaS landing pages, or non-retail templates.
- **FR-003**: System MUST generate design rules using a fixed section structure with sections 1 through 8: Visual Theme & Atmosphere, Color Palette & Roles, Typography Rules, Spacing System, Radius, Shadow & Motion, Component Styling, Layout Principles, and Responsive Behavior.
- **FR-004**: System MUST use a hybrid design file format that contains a machine-readable token block and human-readable design guidance sections.
- **FR-005**: System MUST treat token values in the token block as the source of truth for concrete visual values, while prose sections explain intent, usage, and constraints.
- **FR-006**: System MUST include structured design intent in the design file, including retail category, audience, price tier, chosen archetype, mood, and a short deterministic seed or fingerprint.
- **FR-007**: System MUST NOT store the raw user prompt in the design file; it may store extracted design-relevant facts in plain language.
- **FR-008**: System MUST choose design direction from the user prompt when explicit and infer missing direction from retail category, audience, and price tier when vague.
- **FR-009**: System MUST provide deterministic controlled variety based on the project identity and normalized prompt so different projects can receive different visual directions while the same project remains stable for the same prompt.
- **FR-010**: System MUST allow the agent to create missing colors, typography, spacing, radius, shadow, and component treatments in a designer role when the user does not specify them, subject to validation guardrails.
- **FR-011**: System MUST avoid copying concrete visual values from shared templates or global design examples into generated project design files.
- **FR-012**: System MUST use a fixed Phase 1 token schema where token names remain stable across projects and values vary by project.
- **FR-013**: The fixed color token schema MUST include primary, primary foreground, accent, accent foreground, highlight, highlight foreground, background, surface, muted surface, foreground, muted foreground, border, success, warning, and error roles.
- **FR-014**: System MUST record token provenance in the token block and distinguish at least user-provided values, agent-inferred values, fallback-inferred values, and system-required values.
- **FR-015**: System MUST treat the generated design file as a managed read-only artifact for users; users change design through prompts rather than direct editing.
- **FR-016**: System MUST include a managed-file notice in the design file explaining that it is generated and should be changed through chat.
- **FR-017**: System MUST generate or refresh approved design-token mappings whenever `DESIGN.md` is created, patched, or regenerated.
- **FR-018**: System MUST keep token mapping deterministic and owned by generated token regions or equivalent controlled areas, rather than relying on freeform UI-agent edits.
- **FR-019**: System MUST require the agent to load project design rules before any customer-facing storefront UI mutation can occur.
- **FR-020**: System MUST block customer-facing UI mutation attempts that have not loaded current project design rules in the run.
- **FR-021**: System MUST validate changed customer-facing UI files for design-rule compliance after UI mutation and return repairable errors for violations.
- **FR-022**: System MUST validate normal feature and content updates against changed customer-facing UI files only, while validating full customer-facing storefront scope for initialization, full redesign, and explicit design synchronization.
- **FR-023**: System MUST prevent raw visual values in customer-facing UI files, including raw color functions, arbitrary visual utilities, inline visual styles for visual properties, raw font family strings, and raw shadow values.
- **FR-024**: System MUST allow approved token utilities and semantic design roles that are mapped from the project design rules.
- **FR-025**: System MUST map shared UI semantic roles such as background, foreground, card, muted, primary, secondary, accent, destructive, border, input, and focus ring to project design tokens.
- **FR-026**: System MUST leave `DESIGN.md` unchanged for prompts that only request text changes, feature changes, or local component fit changes.
- **FR-027**: System MUST patch only relevant token values and related explanatory guidance for token-specific design requests, preserving unrelated design intent.
- **FR-028**: System MUST classify identity-level visual requests as redesign requests and synchronize the full customer-facing storefront with the revised design rules.
- **FR-029**: System MUST preserve existing user-provided token choices during redesign unless the current user prompt directly conflicts with them.
- **FR-030**: System MUST validate design files with lightweight custom validation covering parseability, required design intent, fixed token keys, token values, absence of extra Phase 1 token keys, required sections, critical color value validity, contrast, and repairable error messages.
- **FR-031**: System MUST require text contrast of at least 4.5:1 for primary foreground on primary, accent foreground on accent, highlight foreground on highlight, foreground on background, foreground on surface, foreground on muted surface, and readable destructive text on error.
- **FR-032**: System SHOULD warn when muted foreground on background falls below 3:1 and SHOULD prefer 4.5:1 where practical.
- **FR-033**: Documentation MUST explain that each retail project has a generated managed `DESIGN.md`, that token values are the source of truth, that prose sections explain usage, that UI uses mapped token utilities, and that design changes regenerate token mappings.

### Key Entities *(include if feature involves data)*

- **Project Design File**: The managed root `DESIGN.md` artifact for one retail storefront project. It contains structured tokens, design intent, provenance, fixed guidance sections, and managed-file notice.
- **Design Intent**: Extracted or inferred retail design context including category, audience, price tier, archetype, mood, and deterministic seed or fingerprint.
- **Design Token**: A stable named visual role with a concrete value, provenance, and usage role. Token names remain fixed in Phase 1 while values differ per project.
- **Token Mapping**: The generated mapping that makes project design tokens available to storefront UI through approved semantic utilities.
- **Storefront UI Mutation**: A change to customer-facing retail UI surfaces such as components, routes, styles, storefront app layout, visual theme configuration, and visual assets.
- **Design Validation Result**: A pass or repairable failure explaining design file or UI compliance issues.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly initialized retail storefront projects contain a valid root `DESIGN.md` before customer-facing UI files are generated.
- **SC-002**: At least 95% of broad retail initialization prompts produce a valid project-specific design without falling back to a fixed default direction.
- **SC-003**: Two retail projects initialized from the same vague prompt but different project identities produce different valid design directions in at least 80% of sampled pairs while remaining stable for repeated generation of the same project and prompt.
- **SC-004**: 100% of customer-facing UI mutation attempts without loaded project design rules are blocked before changes are accepted.
- **SC-005**: 100% of changed customer-facing UI files are validated for disallowed visual literals in normal feature-update flows.
- **SC-006**: 100% of full initialization, redesign, and explicit sync flows validate the full customer-facing storefront scope for design-rule compliance.
- **SC-007**: 100% of token-specific design changes update token mappings and preserve unrelated design intent.
- **SC-008**: 100% of generated or changed critical color pairs meet the required 4.5:1 contrast threshold before the design is accepted.
- **SC-009**: A reviewer can understand the chosen retail category, audience, price tier, archetype, and core visual rationale from Section 1 of `DESIGN.md` in under 2 minutes.
- **SC-010**: Documentation enables a new contributor to explain how project design rules are created, changed, and enforced without needing clarification from the original author.

## Assumptions

- Retail storefront projects are the only generated UI template category in Phase 1.
- Customer-facing storefront includes shopping pages, storefront layout, product presentation, cart or checkout surfaces when present, and shared UI primitives used by these surfaces.
- Direct user editing of `DESIGN.md` is intentionally out of scope; design changes are requested through chat prompts.
- Integrity handling for design files changed outside the managed pipeline is deferred and not part of this specification.
- Explicit confirmation behavior before full redesign is deferred and not part of this specification.
- Existing root or template design examples are structural references only and are not global visual rules for new projects.
