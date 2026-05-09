# Data Model: AI Provider Thinking Layer

## ThinkingInput

Represents the complete context needed to analyze a user's latest website-builder prompt safely.

**Fields**:

- `projectId`: Unique project identifier.
- `userId`: User identifier associated with the builder run.
- `userPrompt`: Latest raw user request text.
- `projectState`: Current project state or null when no state exists.
- `recentConversationSummary`: Optional concise previous conversation summary.
- `recentUserMessages`: Optional recent user messages with id, content, and timestamp.
- `runtimeContext`: Current source/preview status and supported builder stack.

**Validation Rules**:

- `projectId`, `userId`, and `userPrompt` are required.
- `userPrompt` must be non-empty after trimming.
- Runtime context must explicitly indicate whether source is initialized.
- Secrets and credentials must not be included in prompt context.

**Relationships**:

- Reads from ProjectState and recent ProjectRun history.
- Produces one ThinkingResult per user prompt attempt.

## ThinkingResult

Represents the validated interpretation of the user's request.

**Fields**:

- `intent`: Request category such as initialization, feature addition, design/content/product change, bug fix, integration, explanation, or unknown.
- `confidence`: Numeric confidence from 0 to 1.
- `language`: User prompt language category.
- `userWish`: Explicit requests, conservative implicit requests, ecommerce goals, and out-of-scope requests.
- `ecommerceContext`: Store type, affected pages/sections/features/entities, and conversion goal.
- `projectAction`: Whether to initialize, modify, ask clarification, and which downstream activities are required.
- `constraints`: Preservation expectations, stack/destructive flags, and forbidden actions.
- `risk`: Risk level and reasons.
- `normalizedTask`: Title, description, acceptance criteria, and implementation hints for planning.
- `downstream`: Recommended next step and priority.

**Validation Rules**:

- Must pass schema validation before business validation.
- Cannot request both project initialization and existing project modification simultaneously.
- Clarification must include a question when required.
- Non-initialized projects cannot proceed with non-init work unless clarification is required.
- Initialized projects cannot be treated as new initialization unless a destructive rebuild is explicitly requested.
- Stack changes must require clarification.
- Destructive changes must be high risk.
- Feature-addition requests must identify at least one affected feature.

**State Transitions**:

- `provider_output_received` → `schema_validated` → `business_validated` → `ready_for_agent_task`.
- `provider_output_received` → `schema_failed` → `retry_or_fallback`.
- `business_failed` → `repair_attempted` → `business_validated` or `clarification_fallback`.

## AgentTask

Represents the only downstream task contract consumed by planning and source services.

**Fields**:

- Project/user identifiers and original source prompt for traceability.
- Normalized intent, title, description, ecommerce goal, affected areas, acceptance criteria, hints, risk level, next step, and required downstream actions.

**Validation Rules**:

- Must be derived from a validated ThinkingResult.
- Must not include raw provider output or hidden reasoning.
- Must preserve enough context for planner/source services to act without reinterpreting raw model text.

**Relationships**:

- Built from one ThinkingResult.
- Consumed by planner, source initialization, patch generation, validation, and preview orchestration.

## ThinkingBusinessValidationResult

Represents domain validation results for a ThinkingResult.

**Fields**:

- `ok`: Whether the result can proceed.
- `errors`: Human-readable validation failures for repair or fallback.

**Validation Rules**:

- `errors` must be empty when `ok` is true.
- `errors` must contain at least one actionable reason when `ok` is false.

## SanitizedStreamEvent

Represents client-facing progress and result messages.

**Fields**:

- Event `type` such as analysis started, context loaded, analysis completed, clarification required, plan created, file changed, validation finished, preview ready, done, or error.
- Event `data` containing only safe status/result fields for that event type.

**Validation Rules**:

- Must not include raw provider output, hidden reasoning, partial model chunks, unvalidated JSON, secrets, or stack traces.
- `thinking_completed` may include intent, confidence, summary, affected pages/features, conversion goal, and risk level only.

## ProjectRun Thinking Summary

Represents the safe persisted analysis summary for a builder run.

**Fields**:

- Intent, confidence, summary, affected pages, affected features, risk level, and recommended next step.
- Run status including running, completed, failed, or waiting for clarification.

**Validation Rules**:

- Persist only validated result summaries or explicit clarification/error outcomes.
- Do not persist hidden reasoning, provider deltas, raw unvalidated output, or secrets.
