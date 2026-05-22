# Research: Project Design Rules

## Decision: Keep design rules project-local and generated before storefront UI

**Rationale**: The feature depends on each retail storefront having its own source of truth before any customer-facing UI exists. Generating the design file first prevents the initial UI from inheriting global or template visuals and creates a stable contract for later updates.

**Alternatives considered**:
- Use one repository-level design file for all projects: rejected because it causes storefronts to feel visually similar.
- Generate UI first, then infer design rules from it: rejected because it makes the design file descriptive rather than authoritative.

## Decision: Use hybrid design files with structured tokens and fixed guidance sections

**Rationale**: Structured tokens make validation, token mapping, and provenance reliable. Fixed prose sections preserve human and agent understanding of atmosphere, component treatment, layout, and responsive behavior.

**Alternatives considered**:
- Markdown prose only: rejected because concrete values are hard to parse and validate reliably.
- Structured data only: rejected because agents need narrative design rationale and usage guidance.
- Flexible section names: rejected because predictable sections are needed for validation and consistent agent behavior.

## Decision: Keep Phase 1 token schema closed with stable role names

**Rationale**: Stable token names let storefront UI use consistent semantic utilities while each project varies by value, design intent, and prose. The closed schema also keeps validation and token mapping predictable.

**Alternatives considered**:
- Allow every project to invent token names: rejected because generated UI and validators would drift.
- Use only a minimal color set: rejected because retail storefronts need separate CTA, accent, promotion, surface, and state roles.

## Decision: Use deterministic controlled variety from project identity and prompt fingerprint

**Rationale**: Storefronts need diversity across projects without random behavior inside the same project. A deterministic seed allows the same project and prompt to reproduce its design direction, while different projects can receive different valid archetypes.

**Alternatives considered**:
- Deterministic only from prompt: rejected because identical vague prompts would produce similar storefronts.
- Fully random generation: rejected because reruns would be unstable and hard to debug.

## Decision: Treat generated design rules as managed read-only artifacts

**Rationale**: The system must trust provenance, validation, and token mapping. Allowing direct user edits would create ambiguity around source-of-truth and repair responsibility. Users can still change design through chat prompts.

**Alternatives considered**:
- Let users edit `DESIGN.md` directly: rejected for Phase 1 because manual edits can break parsing and provenance.
- Hide design rules completely: rejected because users and contributors benefit from inspecting the design contract.

## Decision: Gate customer-facing UI mutations on reading design rules

**Rationale**: Prompt instructions alone are not enough to guarantee compliance. A runtime gate prevents UI changes from being accepted before the current project design rules are loaded.

**Alternatives considered**:
- Rely only on agent prompt instructions: rejected because agents can omit required context under pressure.
- Validate only after changes: rejected because early blocking gives clearer repair flow and avoids wasted work.

## Decision: Validate visual drift with static scan scoped to run context

**Rationale**: Normal feature changes should not be blocked by unrelated legacy violations, while initialization and redesign must validate the full customer-facing storefront. Context-aware scope preserves surgical changes and still enforces clean design sync flows.

**Alternatives considered**:
- Always scan the full project: rejected because unrelated legacy violations can block small updates.
- Only scan changed lines: rejected because changed files may introduce or expose component-level drift outside exact patch lines.

## Decision: Use lightweight custom validation rather than a full schema library

**Rationale**: The feature needs a narrow set of checks: managed header, parseable token block, required intent, fixed token keys, values, section headings, color validity, contrast, and repairable errors. Custom validation is enough and avoids adding broad schema complexity for Phase 1.

**Alternatives considered**:
- Full schema validation library: rejected by product decision as unnecessary for this phase.
- No structured validation: rejected because design rules must be trustworthy enough to drive UI generation.
