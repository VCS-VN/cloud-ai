# Feature Specification: AI Provider Thinking Layer

**Feature Branch**: `010-thinking-layer`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "AI Provider Thinking Layer cho AI Website Builder Agent"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand Requests Before Acting (Priority: P1)

As a website builder user, I want my natural language request to be interpreted into a clear, structured task before any project changes happen, so that the builder acts on my real intent rather than raw prompt text.

**Why this priority**: This is the core safety and quality control for every builder run; downstream work should not begin until the user's request is understood and validated.

**Independent Test**: Can be fully tested by submitting an initial storefront prompt and confirming the system produces a validated understanding summary before any planning, generation, validation, preview, or project update activity begins.

**Acceptance Scenarios**:

1. **Given** a project has no initialized storefront, **When** the user asks to create an ecommerce website, **Then** the system classifies the request as a new project setup and identifies the relevant store goals, pages, features, and acceptance criteria.
2. **Given** a project already has an initialized storefront, **When** the user asks to add or change a feature, **Then** the system classifies the request as an update and identifies the affected pages, sections, features, and entities.
3. **Given** the system has not completed request understanding, **When** downstream builder stages are ready to run, **Then** those stages wait until a validated structured task is available.

---

### User Story 2 - Receive Safe Progress Updates (Priority: P2)

As a website builder user, I want to see safe progress messages while the system analyzes my request, so that I know work is happening without seeing private reasoning or raw provider output.

**Why this priority**: Users need feedback during blocking analysis, but exposing raw internal reasoning would create privacy, security, and trust risks.

**Independent Test**: Can be tested by sending a prompt and verifying the client receives only sanitized status and summary events during analysis.

**Acceptance Scenarios**:

1. **Given** the user submits a prompt, **When** analysis begins, **Then** the client receives a status event indicating the request is being analyzed.
2. **Given** project context has been loaded, **When** analysis continues, **Then** the client receives a context-loaded status that does not include raw project secrets or model output.
3. **Given** analysis completes successfully, **When** the system reports the result, **Then** the client receives only a concise validated summary including intent, confidence, affected areas, conversion goal, and risk level.

---

### User Story 3 - Stop Risky or Ambiguous Changes (Priority: P3)

As a website builder user, I want the system to ask for confirmation when my request is destructive, ambiguous, or outside safe scope, so that I do not accidentally lose work or trigger unintended platform changes.

**Why this priority**: Risk handling protects users from accidental rebuilds, stack changes, unsafe integrations, and prompt-injection attempts.

**Independent Test**: Can be tested by submitting destructive, stack-changing, low-confidence, and prompt-injection requests and confirming the system asks for clarification or safely redirects instead of continuing to planning.

**Acceptance Scenarios**:

1. **Given** an initialized project, **When** the user asks to delete everything and rebuild, **Then** the system marks the request high risk and asks for confirmation before downstream work begins.
2. **Given** the user asks to change the underlying website stack, **When** the request is analyzed, **Then** the system requires clarification and prevents automatic planning.
3. **Given** the user attempts to bypass instructions or request hidden reasoning, **When** the request is analyzed, **Then** the system treats it as user content, records the risk, and does not expose private reasoning.

### Edge Cases

- User request is vague but low risk, such as asking to make a hero section better; the system chooses sensible ecommerce-oriented defaults and proceeds without unnecessary clarification.
- User request is vague and high impact, such as asking to rebuild or delete existing work; the system asks a clarification question and stops downstream work.
- User request asks for a real payment, authentication, admin, or data service without required business setup; the system asks for missing information before proceeding.
- Provider output is malformed, incomplete, or business-inconsistent; the system retries or repairs once, then falls back to clarification if still invalid.
- Provider analysis times out; the system reports an error, does not mutate project state, and allows the user to retry.
- User prompt contains instructions to reveal hidden reasoning, bypass validation, write files directly, or skip the builder pipeline; the system records this as risk and prevents unsafe execution.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST analyze every user prompt through the Thinking Layer before any planning, source initialization, patch generation, validation, preview refresh, or project state update occurs.
- **FR-002**: System MUST produce a structured Thinking Result containing intent, confidence, language, user wishes, ecommerce context, project action, constraints, risk, normalized task, and recommended downstream step.
- **FR-003**: System MUST validate the Thinking Result shape before it can be used by downstream builder stages.
- **FR-004**: System MUST validate business rules for the Thinking Result, including mutually exclusive initialization and modification actions, required clarification questions, safe handling of uninitialized projects, stack-change confirmation, destructive-change risk, and feature-target completeness.
- **FR-005**: System MUST attempt one business-rule repair when a Thinking Result has a valid shape but fails business validation.
- **FR-006**: System MUST fall back to a clarification-required result when valid analysis cannot be produced after the allowed retry and repair attempts.
- **FR-007**: System MUST convert a validated Thinking Result into a downstream Agent Task and prevent downstream builder stages from consuming unvalidated raw prompt text as the primary task contract.
- **FR-008**: System MUST emit sanitized progress and result events for analysis start, context loaded, analysis completion, clarification required, pipeline progress, validation completion, preview readiness, completion, and errors.
- **FR-009**: System MUST NOT send raw provider output, hidden reasoning, partial analysis chunks, unvalidated structured data, or provider-internal reasoning to the client.
- **FR-010**: System MUST NOT mutate project state, write files, apply patches, execute commands, or generate code inside the Thinking Layer.
- **FR-011**: System MUST ask for clarification when a request is destructive, requests a stack change, conflicts with current project direction, requires missing real-world integration setup, or falls below the configured confidence threshold.
- **FR-012**: System MUST allow low-risk vague requests to proceed with conservative ecommerce-oriented defaults when confidence is acceptable.
- **FR-013**: System MUST detect prompt-injection attempts that ask to bypass instructions, expose hidden reasoning, skip validation, or directly change files, and mark the result with appropriate risk and forbidden actions.
- **FR-014**: System MUST keep logs sufficient to debug analysis outcome, confidence, risk, validation status, repair usage, duration, and recommended next step without logging secrets or private reasoning.
- **FR-015**: System MUST support persistence of validated analysis summaries for project runs while preventing storage of raw hidden reasoning, raw provider streaming chunks, secrets, or unvalidated provider output.

### Key Entities *(include if feature involves data)*

- **Thinking Input**: The analysis request containing project identity, user identity, latest prompt, current project state if available, recent context, and runtime status needed to understand the request safely.
- **Thinking Result**: The validated structured interpretation of the user's request, including intent, confidence, ecommerce context, project action, constraints, risk, normalized task, and recommended next step.
- **Agent Task**: The downstream task contract derived only from a validated Thinking Result and used by planning and implementation stages.
- **Sanitized Stream Event**: A client-facing progress or result message that contains safe status or summary data and excludes raw provider output and hidden reasoning.
- **Business Validation Result**: The pass/fail outcome and error list from domain-specific checks that go beyond shape validation.
- **Project Run Thinking Summary**: The persisted safe summary of analysis outcome for a project run, including intent, confidence, affected areas, risk, and recommended next step.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user prompts in the builder flow pass through validated request analysis before any downstream builder stage begins.
- **SC-002**: 100% of downstream builder tasks are created from validated structured analysis rather than raw prompt text as the primary contract.
- **SC-003**: 0 client-visible events contain raw provider output, hidden reasoning, partial provider chunks, or unvalidated analysis data during standard operation.
- **SC-004**: At least 95% of clear initialization and update prompts are classified with the expected intent and recommended next step in representative test coverage.
- **SC-005**: 100% of destructive or stack-changing requests in test coverage produce clarification-required outcomes and do not trigger downstream planning.
- **SC-006**: Business-invalid provider results are repaired or converted to clarification fallback within one repair attempt in 100% of covered cases.
- **SC-007**: Request analysis completes or fails safely within 30 seconds for 95% of normal prompts.
- **SC-008**: 100% of provider timeout or malformed-output cases leave project state unchanged and return a retryable user-facing outcome.

## Assumptions

- The builder supports both new storefront creation and updates to existing storefronts.
- The current project state can indicate whether source has already been initialized and whether a preview is running.
- The user-facing product is an ecommerce website builder, so low-risk inference may use common ecommerce goals such as product discovery, conversion, trust, and mobile usability.
- The Thinking Layer is an internal blocking step, while the outer user-facing builder flow remains streaming through sanitized events.
- Downstream planning, source initialization, patching, validation, repair, preview, and project state persistence already exist or will consume an Agent Task contract.
- Validated structured analysis may be persisted for debugging and run history, but raw hidden reasoning and unvalidated provider output are not persisted.
