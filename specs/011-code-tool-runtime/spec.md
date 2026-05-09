# Feature Specification: Code Tool Calling Runtime

**Feature Branch**: `011-code-tool-runtime`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "Add a Code Tool Calling Runtime so the AI Agent can safely access the correct generated project, inspect current source code, make targeted code changes, validate the result, and stream sanitized progress events to the client."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safe Project Inspection Before Change (Priority: P1)

As a storefront builder user, I want the agent to inspect my current generated project before changing it so that requested updates are based on real files instead of assumptions.

**Why this priority**: This is the foundation for accurate edits and prevents the agent from changing the wrong location or inventing files.

**Independent Test**: Can be fully tested by submitting a normal UI change request and confirming the run records successful project context, file discovery, and file reading before any file modification is accepted.

**Acceptance Scenarios**:

1. **Given** a user submits a request to modify an existing storefront, **When** the agent begins the run, **Then** it loads trusted project context and inspects the project source before any mutation is allowed.
2. **Given** the agent requests a file outside the generated project, **When** the backend evaluates the request, **Then** the request is blocked as recoverable and no external file is read or changed.
3. **Given** the agent provides project identity in its requested action, **When** the backend executes the action, **Then** the backend uses only route- or session-bound project identity and ignores untrusted project identity from the agent.

---

### User Story 2 - Auditable Patch-Based Code Changes (Priority: P1)

As a platform operator, I want every agent code change to be scoped, auditable, reversible, and validated so that generated projects remain safe and maintainable.

**Why this priority**: The runtime is only useful if changes are controlled and can be reviewed, repaired, or rolled back when something goes wrong.

**Independent Test**: Can be fully tested by submitting a request that changes a known component and confirming a snapshot is created, a minimal patch is applied only to allowed files, a diff is available, and validation is run afterward.

**Acceptance Scenarios**:

1. **Given** the agent has successfully inspected the project, **When** it requests a code change, **Then** the backend creates a rollback snapshot before the first mutation.
2. **Given** a requested patch touches forbidden files, generated route artifacts, secrets, or paths outside the project, **When** the backend validates the patch, **Then** the patch is rejected without modifying files and the agent receives a recoverable result where appropriate.
3. **Given** a patch applies successfully, **When** the mutation completes, **Then** the run records changed files, insertions, deletions, preview impact, and validation status.

---

### User Story 3 - Resilient Validation and Repair Flow (Priority: P2)

As a storefront builder user, I want the agent to validate and repair its changes when possible so that completed updates are more likely to work in the live preview.

**Why this priority**: Validation closes the loop between editing and a usable project, while repair reduces failed runs caused by common code issues.

**Independent Test**: Can be fully tested by applying a controlled change that causes a validation failure and confirming the run streams validation failure, performs bounded repair attempts, and either passes validation or requests human review.

**Acceptance Scenarios**:

1. **Given** a code mutation succeeds, **When** the mutation phase ends, **Then** the runtime runs available safe validation checks and streams a summarized validation result.
2. **Given** validation fails with a repairable issue, **When** repair budget remains, **Then** the agent inspects the failure, applies a minimal repair, and validates again.
3. **Given** validation still fails after the allowed repair attempts, **When** the run cannot safely recover, **Then** the runtime rolls back when required and asks for human review rather than continuing unsafe changes.

---

### User Story 4 - Sanitized Streaming Progress (Priority: P2)

As a client application user, I want to see clear progress while the agent works without seeing sensitive internals so that I understand what is happening safely.

**Why this priority**: Streaming progress improves trust and responsiveness, but raw provider reasoning, secrets, full files, and unfiltered logs must never be exposed.

**Independent Test**: Can be fully tested by running an agent message and confirming the stream includes high-level lifecycle, tool, patch, validation, repair, preview, completion, and review events without raw file contents, secrets, or private reasoning.

**Acceptance Scenarios**:

1. **Given** a recoverable tool issue occurs, **When** the backend reports it, **Then** the client stream remains open and receives a sanitized status event.
2. **Given** validation produces long output, **When** the result is streamed, **Then** the client receives a redacted summary rather than full raw logs.
3. **Given** the runtime completes a change, **When** final status is emitted, **Then** the client receives changed files, validation status, and a concise summary.

---

### User Story 5 - Human Review for High-Risk Requests (Priority: P3)

As a platform operator, I want broad, destructive, or security-sensitive changes to require human review so that the agent cannot automatically perform risky project transformations.

**Why this priority**: Some requests are too risky for automatic execution and should be explicitly reviewed before any destructive action.

**Independent Test**: Can be fully tested by submitting a request to delete major source areas, switch the storefront foundation, or broadly change sensitive areas and confirming no mutation is applied automatically.

**Acceptance Scenarios**:

1. **Given** a user asks for a broad destructive change, **When** the runtime assesses the request, **Then** it streams a human review required event and does not apply mutations.
2. **Given** a requested patch would change more files than the automatic safety threshold, **When** the backend evaluates the patch, **Then** it blocks automatic application and requests review.

### Edge Cases

- A provider requests a tool that is unknown, incomplete, or currently disallowed; the runtime returns a recoverable tool error when safe and keeps the stream alive.
- A provider requests mutation before inspection; the runtime blocks mutation until successful inspection has occurred.
- A provider requests an absolute path, parent directory traversal, secret file, dependency cache, build output, or another project's storage path; the runtime blocks the request.
- A patch partially applies or conflicts with current files; the runtime prevents unsafe partial state, attempts bounded repair when appropriate, or rolls back.
- A validation command is unavailable for the generated project; the runtime reports the command as skipped or recoverable and allows another available validation path.
- A project mutation run is already active; the runtime queues or waits for the project lock before mutating.
- A preview-affecting file changes; the runtime marks preview synchronization as required while normal component changes rely on live update behavior.
- A project file includes malicious instructions telling the agent to ignore safety rules; backend enforcement still prevents forbidden reads, writes, and commands.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST execute agent-requested project actions only through backend-owned, approved tools.
- **FR-002**: The system MUST bind every tool execution to trusted user, organization, project, message, workspace, state, and stream context provided by the active message run.
- **FR-003**: The system MUST ignore or reject project identity supplied by the agent in tool arguments.
- **FR-004**: The system MUST require at least one successful project context inspection, one successful file discovery or search, and one successful file read before any mutation tool can modify files.
- **FR-005**: The system MUST expose read-only tools for project context, safe file tree discovery, code search, full small-file reads, and targeted file-range reads.
- **FR-006**: The system MUST expose mutation tools for patch application and new file creation while enforcing prior inspection, path safety, file safety, and mutation limits.
- **FR-007**: The system MUST create a rollback snapshot before the first file mutation in a message run.
- **FR-008**: The system MUST support rollback to a snapshot when mutation or validation cannot be safely completed.
- **FR-009**: The system MUST validate patches before application for safe paths, allowed files, patch size, changed file count, package safety, secret-like content, and protected generated files.
- **FR-010**: The system MUST prefer minimal patch-based changes and allow full new-file creation only when the target file does not already exist.
- **FR-011**: The system MUST provide a diff summary for files changed during the current message run.
- **FR-012**: The system MUST run only allowlisted validation commands and MUST NOT expose arbitrary shell execution to the agent.
- **FR-013**: The system MUST run validation after successful mutation unless no safe validation is available, in which case it MUST record validation as skipped with an explanation.
- **FR-014**: The system MUST allow bounded repair attempts after validation failures and MUST stop with human review when repair limits are exhausted.
- **FR-015**: The system MUST acquire a project-level mutation lock for message runs that may change generated project files.
- **FR-016**: The system MUST stream sanitized lifecycle, tool, patch, validation, repair, preview, completion, and human-review events to the client.
- **FR-017**: The system MUST NOT stream private reasoning, secrets, unredacted environment values, full source files, full raw terminal logs, or raw patch payloads to the client.
- **FR-018**: The system MUST redact known secret patterns from file reads, validation output, tool results, event logs, and provider-visible tool outputs.
- **FR-019**: The system MUST persist a tool execution log for each requested tool call, including safe summaries, status, timing, recoverability, and error codes.
- **FR-020**: The system MUST persist message run state including phase, current tool, changed files, validation status, snapshot identity, and update time.
- **FR-021**: The system MUST append successful code change records to project state, including changed files, validation result, tool statuses, preview synchronization outcome, and timestamp.
- **FR-022**: The system MUST update project file manifests and decision records when files are created, deleted, or when durable project decisions change.
- **FR-023**: The system MUST mark preview synchronization as required when configuration, dependency, build, routing, or other preview-impacting files change.
- **FR-024**: The system MUST keep recoverable provider or tool issues from breaking the client stream whenever safe retry, degradation, or human review is possible.
- **FR-025**: The system MUST request human review instead of automatic mutation for broad destructive changes, foundation changes, excessive file changes, broad sensitive-area changes, or repeated validation failure.

### Key Entities *(include if feature involves data)*

- **Tool Execution Context**: Trusted runtime context for a message run; includes user identity, optional organization, project identity, message identity, workspace root, current project state, and stream writer.
- **Project Tool Definition**: Approved tool contract available to the agent; includes name, category, description, input schema, strictness, inspection requirements, mutation-lock requirements, and risk metadata.
- **Project Tool Result**: Structured result returned by each tool; includes success flag, data or recoverable error, warnings, and metadata for tool name, category, project, message, and duration.
- **Tool Execution Log**: Persistent audit record for each tool request; includes safe argument summary, safe result summary, status, error code, recoverability, and timing.
- **Message Run State**: Persistent state for one message execution; tracks phase, current tool, changed files, validation status, snapshot identity, and last update time.
- **Project Snapshot**: Restorable source and state checkpoint created before mutation; includes snapshot identity, project identity, message identity, file tree hash, file checksums, stored content references, and project state.
- **Patch Result**: Summary of an applied change; includes changed, created, modified, and deleted files, insertion and deletion counts, preview restart need, package install need, and warnings.
- **Validation Result**: Summary of validation attempts; includes command-level status, summarized output, duration, and whether repair is possible.
- **Code Change Record**: Project state history entry describing a completed code-agent change; includes message, prompt, task title, changed files, validation status, tool statuses, preview outcome, and creation time.
- **Sanitized Stream Event**: Client-facing event describing runtime progress without private reasoning, secrets, full file contents, or unsafe raw logs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of automatic file mutations are preceded by successful project inspection events in the same message run.
- **SC-002**: 100% of attempts to access paths outside the active generated project are blocked without reading or modifying external files.
- **SC-003**: 100% of successful mutation runs create a rollback snapshot before the first file change.
- **SC-004**: At least 95% of normal single-feature UI change requests complete with no unrelated files changed.
- **SC-005**: At least 90% of recoverable provider tool mistakes keep the client stream open and produce a sanitized recoverable status event.
- **SC-006**: 100% of completed mutation runs record changed files, validation status, and tool execution statuses in persistent run history.
- **SC-007**: 100% of client-visible progress events omit private reasoning, secrets, full source files, raw patch content, and unredacted full logs.
- **SC-008**: 100% of unsupported broad destructive requests result in human review without automatic file mutation.
- **SC-009**: Users receive the first visible progress event within 2 seconds for at least 95% of message runs under normal service conditions.
- **SC-010**: Validation outcome is available within the final run summary for 100% of successful mutation runs, either passed, failed, or skipped with a reason.

## Assumptions

- Generated project source is stored in a project-specific workspace and all agent file paths are relative to that workspace root.
- The existing message-based project stream remains the source of truth for user-visible execution progress.
- The backend, not the AI provider, is responsible for tool execution, path enforcement, validation, patching, preview synchronization, persistence, and rollback.
- The first release prioritizes safe inspection, patching, snapshots, validation, repair, and sanitized streaming over advanced autonomous package management.
- Existing access control already determines whether a user can access a project before message execution begins.
- Full raw logs and detailed tool data may be retained server-side only when safe, but client-visible events are always summarized and redacted.
- Normal component and content changes do not require preview restart; preview synchronization is reserved for configuration, dependency, build, routing, or equivalent preview-impacting changes.
