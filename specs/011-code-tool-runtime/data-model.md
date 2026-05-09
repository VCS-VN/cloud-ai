# Data Model: Code Tool Calling Runtime

## ToolExecutionContext

Represents trusted runtime context for one message execution.

**Fields**:

- `userId`: authenticated user executing the message.
- `orgId`: optional organization scope.
- `projectId`: trusted project identity from route/session authorization.
- `messageId`: trusted message identity for this run.
- `workspaceRoot`: absolute generated-project workspace root resolved by backend.
- `projectState`: current project state available to the agent runtime.
- `stream`: server-side writer for sanitized client events.

**Validation Rules**:

- Must be created by backend route/message runner only.
- Must not accept `projectId`, `messageId`, or `workspaceRoot` from provider arguments.
- `workspaceRoot` must resolve to the active generated project workspace.

## CodeToolDefinition

Represents a backend-approved tool the provider may request.

**Fields**:

- `name`: unique tool name.
- `category`: one of inspect, mutate, validate, snapshot, or preview.
- `description`: provider-facing purpose.
- `parametersJsonSchema`: strict provider tool schema.
- `strict`: whether the provider schema is strict.
- `requiresInspection`: whether successful inspection must precede execution.
- `requiresMutationLock`: whether project mutation lock is required.
- `highRisk`: whether tool requires additional review policy.

**Validation Rules**:

- Unknown tools are rejected with recoverable error when safe.
- Mutation tools require prior inspection.
- Tool availability is narrowed by current phase.

## ProviderFunctionToolCall

Represents a provider-requested function call.

**Fields**:

- `callId`: provider call correlation identity.
- `name`: requested tool name.
- `arguments`: provider-supplied JSON or JSON-like payload.

**Validation Rules**:

- Arguments are soft-normalized before execution.
- Project identity inside arguments is ignored or rejected.
- Unsafe paths, disallowed commands, and forbidden patch targets are hard-blocked.

## ProjectToolResult

Represents structured output from every project tool.

**Fields**:

- `ok`: success flag.
- `data`: successful result payload.
- `error`: structured error with code, message, and recoverability.
- `warnings`: safe warning summaries.
- `metadata`: tool name, category, project identity, message identity, and duration.

**Validation Rules**:

- Must be JSON-serializable for provider tool output.
- Client stream receives only sanitized summaries derived from this result.
- Secret-like values must be redacted before provider or client exposure.

## ProjectToolExecutionLog

Persistent audit record for each tool request.

**Fields**:

- `id`: unique log identity.
- `projectId`: trusted project identity.
- `messageId`: trusted message identity.
- `toolName`: requested tool.
- `category`: tool category.
- `status`: started, completed, failed, or blocked.
- `safeArgsSummary`: redacted argument summary.
- `safeResultSummary`: redacted result summary.
- `errorCode`: optional structured error code.
- `recoverable`: whether failure can be retried or degraded.
- `startedAt`: start timestamp.
- `completedAt`: optional completion timestamp.
- `durationMs`: execution duration.

**Validation Rules**:

- Must never store raw secrets or full unsafe logs.
- Must be queryable by project and message.
- Blocked tool calls must be logged.

## ProjectMessageRunState

Persistent state for a message execution.

**Fields**:

- `projectId`: trusted project identity.
- `messageId`: trusted message identity.
- `phase`: created, thinking, code_context, code_tool_loop, patching, validating, repairing, preview_sync, completed, failed, or human_review_required.
- `currentTool`: optional current tool name.
- `changedFiles`: relative changed file paths.
- `validationStatus`: passed, failed, or skipped.
- `snapshotId`: optional active rollback snapshot.
- `updatedAt`: last update timestamp.

**State Transitions**:

- `created` → `thinking` → `code_context` → `code_tool_loop`.
- `code_tool_loop` → `patching` when mutation starts.
- `patching` → `validating` after successful mutation.
- `validating` → `repairing` when repairable validation failure occurs.
- `repairing` → `validating` for bounded retries.
- Any active phase → `human_review_required` for high-risk or exhausted repair budget.
- Any active phase → `failed` for unrecoverable infrastructure errors.
- Successful run → `preview_sync` when preview impact is detected, otherwise `completed`.

## ProjectSnapshot

Rollback checkpoint created before first mutation.

**Fields**:

- `snapshotId`: snapshot identity.
- `projectId`: trusted project identity.
- `messageId`: trusted message identity.
- `fileTreeHash`: hash of source tree at snapshot time.
- `files`: relative path, checksum, and content reference per captured file.
- `projectStateJson`: project state at snapshot time.
- `createdAt`: creation timestamp.

**Validation Rules**:

- Must be created before first mutation.
- Must include enough data to restore changed source and project state.
- Must exclude forbidden directories and secret files from provider-visible output.

## PatchResult

Summary of patch application.

**Fields**:

- `changedFiles`: all changed relative file paths.
- `createdFiles`: created files.
- `modifiedFiles`: modified files.
- `deletedFiles`: deleted files.
- `insertions`: inserted line count.
- `deletions`: deleted line count.
- `requiresPreviewRestart`: preview restart marker.
- `requiresPackageInstall`: package install marker.
- `warnings`: safe patch warnings.

**Validation Rules**:

- Patch size and changed file count must be within configured limits.
- Forbidden paths and protected generated files are blocked.
- Package changes require package policy validation.
- Secret-like additions are blocked or require review.

## ValidationResult

Summary of validation command execution.

**Fields**:

- `status`: passed, failed, or skipped.
- `commands`: command-level status, exit code, summarized output, and duration.
- `canRepair`: whether the failure can enter repair flow.

**Validation Rules**:

- Commands must be allowlisted.
- Missing scripts are recoverable/skipped and do not alone fail the full message.
- Output must be redacted and truncated before provider/client exposure.

## CodeChangeRecord

Project state history entry for completed code-agent changes.

**Fields**:

- `messageId`: message identity.
- `userPrompt`: user request summary.
- `agentTaskTitle`: task title produced by thinking layer.
- `changedFiles`: changed relative file paths.
- `validationStatus`: passed, failed, or skipped.
- `toolCalls`: tool names and statuses.
- `previewRestarted`: whether preview sync restarted runtime.
- `createdAt`: timestamp.

**Validation Rules**:

- Appended only after code tool run reaches completed or reviewable final state.
- File manifest updates must accompany created/deleted files.
- Decision log updates only when durable product or architecture decisions changed.

## SanitizedStreamEvent

Client-facing progress event.

**Fields**:

- `type`: event type.
- `projectId`: trusted project identity.
- `messageId`: trusted message identity.
- `data`: event-specific safe payload.

**Validation Rules**:

- Must include project and message identity.
- Must omit raw chain-of-thought, secrets, full source files, raw patch payloads, and full logs.
- Recoverable errors should keep the stream open when safe.
