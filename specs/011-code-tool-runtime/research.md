# Research: Code Tool Calling Runtime

## Decision: Backend-owned tool execution with provider-suggested actions

**Rationale**: The provider should reason about which project action is needed, but the backend must own execution because it has trusted route/session context, project authorization, workspace root, persistence, lock ownership, and redaction responsibilities.

**Alternatives considered**:

- Let provider read/write files directly: rejected because it cannot reliably enforce project scope, auditability, or secret protections.
- Generate full patches without inspection: rejected because current project structure can drift from assumptions.
- Expose a generic shell tool: rejected because validation and source operations must be allowlisted and bounded.

## Decision: Inspect-before-mutate phase gate

**Rationale**: Requiring successful context, discovery/search, and file read before mutation directly addresses wrong-file and hallucinated-file risks. The executor enforces the gate even if the provider skips it.

**Alternatives considered**:

- Prompt-only instruction to inspect first: rejected because prompt compliance is not a security boundary.
- Require only project context: rejected because context alone does not prove the relevant source file was located and read.
- Allow mutation for create-only tasks without read: rejected for MVP because project conventions still need inspection before adding files.

## Decision: Relative path guard with forbidden file policy

**Rationale**: Tool paths are model-supplied untrusted input. A single resolver and forbidden-path policy ensures all read, search, patch, snapshot, and diff operations remain within the generated project workspace and avoid secrets, caches, build output, and protected generated artifacts.

**Alternatives considered**:

- String prefix checks at each tool: rejected because duplicated checks are error-prone.
- Allow absolute paths after workspace prefix validation: rejected because relative paths are simpler for provider prompts and safer for audit summaries.
- Rely on operating-system sandbox only: rejected because business boundaries are per project, not just per process.

## Decision: Patch-first mutation with snapshot-backed rollback

**Rationale**: Unified patches are auditable, minimal, diffable, and easier to validate before application than full rewrites. A snapshot before first mutation allows rollback when patching, validation, or repair cannot safely complete.

**Alternatives considered**:

- Full file writes for all changes: rejected because they obscure intent and increase unrelated-change risk.
- Git-only rollback: rejected because generated projects may not be independent Git repositories and message runs need project-scoped snapshots.
- Snapshot after mutation: rejected because rollback must represent the known-good pre-change state.

## Decision: Allowlisted validation commands and bounded repair

**Rationale**: Validation improves confidence, but arbitrary commands are unsafe. A small command allowlist covers project health checks while bounded repair attempts prevent infinite loops and uncontrolled churn.

**Alternatives considered**:

- Skip validation for speed: rejected because the feature's definition of done requires validated code changes.
- Allow provider-supplied commands: rejected because it becomes a shell escape vector.
- Unlimited repair attempts: rejected because it can degrade user trust and create large unreviewed changes.

## Decision: Sanitized client event stream, detailed server audit

**Rationale**: Users need progress visibility, while raw chain-of-thought, secrets, full files, full patches, and full logs must not be exposed. The client receives high-level typed events; server-side logs retain safe summaries and recoverability metadata for debugging.

**Alternatives considered**:

- Stream raw provider deltas: rejected because they may include private reasoning or incomplete tool arguments.
- Stream full tool inputs/outputs: rejected because file contents, patch content, and logs may contain sensitive data.
- Hide all progress until completion: rejected because long-running message runs need responsive feedback.

## Decision: Project-level mutation lock for MVP

**Rationale**: A single mutation lock per project avoids races between concurrent message runs, file snapshots, patch application, validation, and preview synchronization. Read-only concurrency can be revisited after mutation safety is proven.

**Alternatives considered**:

- File-level locks: rejected for MVP because cross-file patches and validation operate on whole project state.
- No locking: rejected because snapshots and patches can race.
- Read/write lock split: deferred because the first release favors correctness over concurrency complexity.

## Decision: Preview restart policy based on changed file categories

**Rationale**: Normal component and content edits should rely on live update behavior, while dependency, config, build, routing, and equivalent runtime-affecting files require explicit preview synchronization.

**Alternatives considered**:

- Always restart preview: rejected because it slows normal UI edits and disrupts feedback.
- Never restart preview: rejected because config/package changes can leave preview stale.
- Let provider decide preview restart: rejected because backend can determine it more reliably from changed files.
