# Feature Specification: Codex SDK Chat Migration

**Feature Branch**: `027-codex-sdk-chat-migration`
**Created**: 2026-06-07
**Status**: Draft
**Input**: User description: Migrate the project-detail chat agent from the legacy ai-agent path to the Codex SDK builder-runs path so that the patch-apply bug (file structure scrambling on pure-insertion hunks) is eliminated, while preserving chat history, reasoning effort, plan-mode workflow, and design-variant clarification with retail vibe.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hero image update produces a working preview (Priority: P1)

A retailer is iterating on their storefront preview. They open project detail, type "thêm image vào hero" in the chat composer, and submit. The agent updates the home page, the preview reloads, and the new hero image appears. The preview never shows a parser error or a scrambled file.

**Why this priority**: This is the exact bug surface that broke production trust. Until ordinary chat updates land cleanly, every other feature is moot.

**Independent Test**: With a project already initialized, send a single update prompt that targets a known section. After the run completes, the preview must render without a syntax error and the targeted section must reflect the requested change.

**Acceptance Scenarios**:

1. **Given** a healthy initialized project preview, **When** the user sends an update prompt that adds an image to the hero, **Then** the run completes successfully and the preview renders without parser errors.
2. **Given** the same project, **When** the user sends a multi-step update prompt (e.g., "đổi màu nút và thêm banner"), **Then** all changes apply atomically and the preview renders without parser errors.
3. **Given** a chat history with prior messages, **When** the user reloads the page after a successful run, **Then** the prior user prompt and the agent answer are still shown in chat history.

---

### User Story 2 - Progress feedback respects code/structure privacy (Priority: P1)

While the agent is working on a chat update, the user sees progress messages framed at the page or section level (for example "Đang cập nhật phần hero ở trang chủ", "Đang kiểm tra preview"). The user never sees raw file paths, code snippets, identifiers, or implementation language.

**Why this priority**: Storefront builders target non-technical retailers; leaking code/structure breaks trust and audience fit. Privacy must hold even mid-failure.

**Independent Test**: Capture all user-visible progress messages emitted during a run end-to-end (loading, planning, building, validation, finalization). None of the captured messages may contain a file extension, file path segment, code identifier, or code snippet.

**Acceptance Scenarios**:

1. **Given** a chat update run in progress, **When** the agent transitions through phases (loading context, planning, building, checking preview, finalizing), **Then** every progress message references the affected page/section in human language and never reveals file paths, code, or framework terms.
2. **Given** the agent ends a turn successfully, **When** the final summary message appears in chat, **Then** it confirms what changed at section level (for example "Đã thêm ảnh vào phần hero ở trang chủ") without quoting code or file names.
3. **Given** the agent fails mid-run, **When** the failure surfaces to the user, **Then** the message states a friendly cause and a next step ("Thử lại"), without exposing internal error frames.

---

### User Story 3 - Plan mode produces a reviewable plan before any change (Priority: P2)

The user toggles plan mode in the composer and submits a prompt. The agent returns a structured plan (Understanding, Findings, Proposed Plan, Files To Change as section names, Risks/Edge Cases, Validation Plan, Questions) and asks for approval. No files change until the user clicks Approve. If the user clicks Reject, the run ends with no mutation.

**Why this priority**: Plan mode is a deliberate safety gate for non-trivial changes; it must be exercisable before tackling design variants. Plan mode is independently demoable on top of US1+US2.

**Independent Test**: Toggle plan mode, send any non-trivial prompt, and verify that (a) a plan message appears with the required sections, (b) no file changes occur on disk, (c) approval triggers a follow-up execution turn that does mutate, and (d) rejection ends the run cleanly.

**Acceptance Scenarios**:

1. **Given** plan mode is on, **When** the user submits a prompt, **Then** the agent returns a plan message with the required structure and the project workspace is unchanged.
2. **Given** a plan was returned, **When** the user clicks Approve, **Then** the agent continues and applies the plan, and the preview eventually reflects the changes.
3. **Given** a plan was returned, **When** the user clicks Reject, **Then** the run ends without mutating any file and the chat shows the rejected plan as a finalized message.
4. **Given** a plan turn is in flight, **When** the user inspects the workspace, **Then** the workspace shows zero pending writes from the plan turn.

---

### User Story 4 - Init flow offers four retail-vibe design variants and respects the choice (Priority: P2)

A retailer creates a new project. The agent generates four design variants, all framed in a retail vibe (e.g., minimalist retail, warm retail, luxury retail, playful retail). Each variant is shown as a visual-lite card (palette dots + a one-line description). The user picks one. The agent builds the storefront in line with the selected variant.

**Why this priority**: Pickable retail variants is a core differentiator for project initialization. Independently demoable on top of US1+US2 once init pipeline routes through Codex.

**Independent Test**: Initialize a brand-new project, observe four variants in the clarification step, pick one, and verify that the resulting build visibly reflects the chosen palette/typography vibe.

**Acceptance Scenarios**:

1. **Given** a brand-new empty project, **When** the user submits the init prompt, **Then** the agent pauses with four retail-vibe variants and the chat renders four visual-lite cards.
2. **Given** the variants are displayed, **When** the user picks one, **Then** the agent resumes and builds the storefront aligned with the selected variant's palette and typography.
3. **Given** the user submits a custom answer instead of picking a card, **When** the agent resumes, **Then** the agent treats the custom text as design guidance and proceeds.

---

### User Story 5 - Skill clarification renders as a simple list (Priority: P3)

When the agent needs a quick disambiguation (for example, picking among a small set of skills), the chat shows a simple list of options (label per option) and the user picks one with a single click. The flow is visually distinct from the design-variant cards.

**Why this priority**: Provides a clean, lower-effort UI surface for non-design clarifications. Lower priority than US4 because it serves a narrower audience interaction.

**Independent Test**: Trigger a skill clarification (for example, by sending a prompt that the agent cannot disambiguate) and verify a simple-list UI appears, distinct from the design-variant card UI.

**Acceptance Scenarios**:

1. **Given** the agent emits a skill clarification, **When** the chat renders the question, **Then** it appears as a simple list with one label per option, not as visual cards.
2. **Given** the user selects an option, **When** the agent resumes, **Then** the run continues with the selected option applied.

---

### User Story 6 - In-flight runs survive process restart safely (Priority: P3)

The user sends a chat prompt and the run is mid-flight when the backend process restarts (deploy, crash, manual restart). After restart, the chat reflects an interrupted run with a clear "retry" affordance. The user retries; a fresh run starts cleanly. No partial files are left in a broken state from the interrupted run; the preview either reflects the prior good state or the new successful run.

**Why this priority**: Restart-safety is required by the persistence model but is not the most common case; users hit it intermittently.

**Independent Test**: Start a run, kill the server mid-run, restart, reload the chat, and confirm the run is marked interrupted with a retry option, the preview is not broken, and a retry produces a successful run.

**Acceptance Scenarios**:

1. **Given** a run is in flight, **When** the server process restarts, **Then** the chat shows the run as interrupted/failed with a retry affordance after reconnect.
2. **Given** a run had reached awaiting-clarification before restart, **When** the user reconnects, **Then** the clarification state is recovered and the user can still answer.
3. **Given** the user retries an interrupted run, **When** the new run completes, **Then** the preview reflects the successful new run without artifacts from the interrupted attempt.

---

### Edge Cases

- The user sends an update prompt the agent cannot classify confidently (ambiguous between update and new-route). The system makes a deterministic choice based on project state and never silently runs init.
- The agent emits user-visible progress text that contains a file path or code-like token. The system filters or rephrases before display so privacy holds.
- The user toggles plan mode and the plan turn fails mid-way (e.g., reasoning timeout). The system shows a friendly failure and offers retry; nothing is mutated.
- The user clicks Approve on a plan, but workspace state has drifted (concurrent edit). The system handles the drift safely and reports a friendly error rather than producing a broken preview.
- The user reloads the page during a successful run that has just finished. The chat shows the user prompt and the final summary; no progress timeline remains visible (transient).
- The user reloads during an awaiting-clarification state. The clarification UI is recovered and answerable.
- The reasoning-effort dropdown is set to the highest level for a quick prompt. The system honors the setting without asking again.
- The agent generates four "retail" variants but they all look near-identical. The system surfaces them anyway; the user can iterate post-pick via chat updates.
- The agent attempts to mutate during plan mode. The system blocks the mutation and ends the plan turn with a friendly error.
- The user is on a slow connection; the SSE stream stalls. The system reconnects once before failing; the user sees a clear status, not a frozen UI.

## Requirements *(mandatory)*

### Functional Requirements

#### Chat run lifecycle
- **FR-001**: The system MUST accept a chat prompt from the project-detail composer and produce a single agent run that mutates the storefront workspace through the Codex SDK only, never through the legacy patch path.
- **FR-002**: The system MUST classify each new run into exactly one of: init, update, new-route. Classification MUST be deterministic from project state when the project is empty (init) and otherwise from prompt analysis (update vs. new-route).
- **FR-003**: The system MUST persist each user prompt and the agent's final summary message to chat history so that reload restores the conversation.
- **FR-004**: The system MUST stop the run cleanly when the user clicks Stop, with no partial preview corruption.
- **FR-005**: The system MUST allow the user to retry a failed or interrupted run from chat without leaving the project page.

#### Progress feedback (page/section privacy)
- **FR-006**: The system MUST emit progress messages framed at the page or section level (e.g., home page, hero section, product card), localized to the user's language.
- **FR-007**: User-visible progress and final summary text MUST NOT contain file paths, file extensions, code identifiers, framework names, or code snippets.
  - **SUPERSEDED (unblock-message change)**: This restriction now applies ONLY to the transient progress surface (skeleton labels/details, section-framed timeline). Codex agent message CONTENT — `agent_message`, `reasoning`, and the final `answer` — is intentionally passed through verbatim and persisted so the UI can render every message the codex SDK produces, by type. The content filter (`extractSummary`/`isPrivacySafe`) was removed from the message-body path.
- **FR-008**: The system MUST emit a final one-line summary at the end of every successful turn that confirms what changed at section level.
- **FR-009**: When the agent works on phases without a file artifact (e.g., reading context, validating preview), the system MUST emit human-readable phase messages.

#### Reasoning effort
- **FR-010**: The composer MUST expose a reasoning-effort selector with at least four levels and the chosen level MUST be honored end-to-end for that run.
- **FR-011**: The system MUST persist the chosen reasoning level on the run record so retries can either reuse or override the original level.

#### Plan mode (two-phase)
- **FR-012**: The composer MUST allow the user to toggle plan mode for a run.
- **FR-013**: When plan mode is on, the agent MUST return a structured plan covering Understanding, Findings, Proposed Plan, Files To Change (as user-friendly section names, not paths), Risks/Edge Cases, Validation Plan, and Questions, and MUST NOT mutate any project files or run any disk-write commands during the plan phase.
- **FR-014**: The chat MUST render the plan with explicit Approve and Reject controls.
- **FR-015**: On Approve, the system MUST continue the same run with an execution phase that may mutate files; the original plan MUST remain visible in chat history.
- **FR-016**: On Reject, the system MUST terminate the run without mutating files and mark the plan as rejected.
- **FR-017**: If the plan phase fails or times out, the system MUST surface a friendly failure with a retry option and MUST NOT have mutated any file.

#### Design variants (retail vibe) and clarifications
- **FR-018**: When initializing an empty project, the system MUST present exactly four design variants framed in a retail vibe and pause the run for user selection.
- **FR-019**: Each design variant MUST be rendered as a visual-lite card showing a short label, a one-line description, and a small palette swatch. The chat MUST NOT show file paths or code snippets in the variant cards.
- **FR-020**: When the user picks a variant, the system MUST resume the run and complete the storefront build aligned to that variant.
- **FR-021**: The user MUST be able to provide a free-text answer instead of picking a card; the agent MUST treat that text as design guidance.
- **FR-022**: For non-design clarifications (e.g., skill disambiguation), the chat MUST render a simple list of options (label only) visually distinct from variant cards.

#### Restart safety
- **FR-023**: The system MUST persist enough run state (status, current phase, awaiting-clarification details) so that after a server restart, the chat can show an interrupted state with a retry option, or recover an awaiting-clarification flow.
- **FR-024**: The system MUST NOT attempt to resume an in-flight execution turn that was interrupted by restart; instead, it MUST mark the run as failed/interrupted and require an explicit user retry.
- **FR-025**: After restart, the chat MUST never show a mid-progress timeline that no longer corresponds to a live run.

#### Migration order and continuity
- **FR-026**: After Phase 1 of the migration, the existing chat UI MUST work end-to-end against the new agent path with zero visible regression for ordinary update prompts.
- **FR-027**: After Phase 5 of the migration, the legacy chat agent path MUST no longer be reachable from the application or required at runtime; chat MUST function from a single agent path only.
- **FR-028**: At every phase boundary, the chat MUST remain functional for the previously delivered priorities (P1 first, then P2, then P3).

### Key Entities *(include if feature involves data)*

- **Project**: A retailer's storefront workspace, with a status (draft / generating / ready / failed) and a processing state (idle / processing). The status drives init detection.
- **Chat Message**: A user prompt or an agent answer attached to a run. Persisted across reloads. Carries kind (user prompt, plan, answer, clarification, error) and optional clarification metadata.
- **Run**: A single agent execution attached to a user prompt. Has a status (queued / running / awaiting clarification / completed / failed / cancelled / interrupted), a kind (init / update / new-route), a reasoning-effort selection, and a plan-mode flag.
- **Progress Event**: A transient signal emitted during a run (phase change, section update, final summary). Not persisted past run terminal state.
- **Design Variant**: One of four retail-vibe options offered during init, with a label, short description, and a small palette swatch. Selection is recorded on the run.
- **Clarification**: A pause in a run requesting user input. Has a question type (design variant / skill clarification), a list of options, and a selected answer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero project-detail chat runs produce a preview parser error in two consecutive weeks of usage after Phase 1 ships (regression-killer for the original bug).
- **SC-002**: 100% of user-visible progress and final-summary messages, sampled across at least 200 real runs, contain no file paths, file extensions, code identifiers, framework names, or code snippets.
  - **SUPERSEDED (unblock-message change)**: Scope narrowed to the transient progress surface only (skeleton labels/details, timeline section framing). Agent message content is now shown verbatim by design — see FR-007 note.
- **SC-003**: At least 95% of update prompts that succeed today on the legacy path also succeed end-to-end on the new path during a parallel-comparison week.
- **SC-004**: Median time-to-first-progress-message after submit stays below the legacy path's measured median, and 95th percentile stays within 1.25x of the legacy 95th percentile.
- **SC-005**: After Phase 5, the codebase contains exactly one chat agent path; an automated check confirms the legacy directories are absent and no runtime route serves the legacy chat endpoints.
- **SC-006**: Plan mode never mutates the workspace during the plan phase, verified by a workspace-diff check on at least 50 plan-mode runs.
- **SC-007**: For init runs, at least 90% of users who reach the variant step pick a card or submit a custom answer within five minutes (no abandonment due to UI confusion).
- **SC-008**: After a forced server restart during an in-flight run, 100% of affected chats reconnect and present either a recovered awaiting-clarification state or an interrupted state with a retry option, in under ten seconds after the server is back.
- **SC-009**: Reasoning-effort selection is honored on at least 99% of runs (verified by run record audit) and rerunning a failed run reuses the original level by default.

## Assumptions

- The Codex SDK exposes the necessary controls (sandbox mode, reasoning effort, structured stream events including file-change items) needed to implement plan mode, restart-safety boundaries, and section-level progress derivation. If any specific control is missing, the implementation phase will surface it as a verification finding before relying on it.
- TanStack Router file-based routing means each route file maps to a navigable URL; the file-to-section mapping for progress messages can be derived from this mapping plus a small curated table for shared sections (hero, product card, header, footer).
- Retail vibe variants will be steered by a curated skill or prompt asset; the prompt-engineering effort to keep all four variants on-vibe is part of the implementation, not an external dependency.
- The existing chat schema (user/agent messages, run records) is sufficient for the new path; no destructive schema migration is required, only additive fields where needed for plan-mode and clarification metadata.
- The project is pre-production; minor data loss during the migration window (e.g., previously interrupted runs that no longer resume) is acceptable.
- Codex SDK threads share their sandbox configuration across turns within the same thread. If verification proves otherwise, plan and execute will run as two separate threads — this changes mechanics but not the user-visible flow.
- The user base is non-technical and Vietnamese-locale-first; progress and summary messages will default to Vietnamese with locale fallback.
- "Restart-safe" means UI state recovery, not codex-thread continuation; an in-flight execution turn cannot be resumed across restart and will be marked interrupted.
