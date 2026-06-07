# Feature Specification: Generic Skill Runtime (Phase 2)

**Feature Branch**: `026-skill-runtime`
**Created**: 2026-06-06
**Status**: Draft
**Input**: `skill-runtime-discussion-summary.md` (full design); `docs/codex-sdk-migration-grill-summary.md` section "Codex SDK Flow Alignment With Skill Runtime"; `specs/025-codex-sdk-migration/spec.md` FR-043–FR-047 (forward-compat slots reserved by phase 1).

## Context

Phase 1 of the Codex SDK migration shipped a builder runtime with intentionally stable extension points: a `<selected_instruction>` wrapper, `selectedInstructions[] / pendingInstructions[]` schema fields on `builder_runs`, and a reserved `SKILLS_ROOT` env var. Phase 1 did not implement any skill detection, scoring, clarification, or `project_read_skill` tool. Foundation prompt instructions are baked into the templates under `templates/codex-builder/foundation/*` and injected wholesale on every run.

Phase 2 activates the generic skill runtime described in `skill-runtime-discussion-summary.md`. The runtime selects skills per-run from a deterministic registry, uses scoring to pick which skills to inject, asks at most one clarification question when truly ambiguous, exposes a tool that lets the Codex turn pull additional skill content on demand, and ships `design-taste-frontend` as the first concrete skill at `$SKILLS_ROOT/design-taste-frontend/SKILL.md`.

## Locked Decisions

These were chosen during the clarification round preceding this spec and are not to be re-asked:

- **Detector**: hybrid. Deterministic scoring is primary. An LLM tie-break call fires only when the top two candidates fall within a tunable point gap (default 10) inside the 50–79 candidate band. Tie-break receives skill metadata only — never `SKILL.md` content.
- **Clarification UX**: when triggered, the builder run pauses with milestone `awaiting_clarification`, persists `pendingSkills[]` in run metadata, emits a single product-safe question over SSE, and does not create a draft workspace or start the Codex thread until the user answers. On answer, the detector is re-run with the original prompt + the answer + pending metadata; pending required/explicit skills carry a high score on rerun so they survive.
- **Phase 2 scope**: full runtime (loader + parser + detector + clarification + injection + tool) plus `design-taste-frontend` as the first and only seeded skill. Other skills are added by manual file drop into `$SKILLS_ROOT` post-launch.
- **Codex tool surface**: pre-injection of selected skills into the Codex context bundle PLUS a `project_read_skill({ name })` tool the Codex turn can call to load additional skills mid-conversation.

## No Backward Compatibility

- Phase 1's `<selected_instruction>` wrapper continues to coexist while foundation templates migrate to skill-driven content over time. There is no rename and no deprecation in this phase.
- The legacy `tasteSkillLoaded` flag and `project_read_taste_skill` tool stay deleted. The new `project_read_skill` tool is the only skill-loading surface.
- Skills that were directly written into foundation templates in Phase 1 are not auto-converted. Conversion happens manually, one foundation block at a time, in follow-up PRs.

## Out of Scope

- Rewriting the legacy AI Agent UI under `src/routes/projects/$projectId.tsx` or its sibling pages. Those continue to coexist with the new builder-runs flow per the Phase 1 deferral note (`specs/025-codex-sdk-migration/tasks.md` T092–T101).
- Deleting the legacy `src/features/ai-agent/*` runtime or dropping the `agent_runs` table. Both remain a separate follow-up PR.
- Multi-tenant skill registries or per-project skill overrides. There is exactly one global `$SKILLS_ROOT` directory.
- Hot-reloading skills inside a running app process. Skills load at boot only; updating a `SKILL.md` requires an app restart.
- Skill marketplace, external skill download, or remote skill registries.
- Backward-compat aliases for the removed `tasteSkillLoaded` flag or `project_read_taste_skill` tool.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Skill auto-applied to an init run (Priority: P1)

An operator runs `init` on a fresh project. The active init template declares `requiredSkills: [design-taste-frontend]` in its frontmatter. The skill registry has `design-taste-frontend` available at `$SKILLS_ROOT/design-taste-frontend/SKILL.md`. The detector picks the skill automatically, no clarification is asked, the Codex context bundle includes `<selected_skill name="design-taste-frontend" …>SKILL.md content…</selected_skill>`, and the published storefront reflects the skill's anti-slop rules.

**Why this priority**: This is the primary value case for Phase 2. If automatic skill application does not work, the runtime delivers nothing.

**Independent Test**: From an empty project, submit one init prompt. Observe milestones go straight from `loading_context → planning → creating_draft → …`, never through `awaiting_clarification`. Verify the run's persisted `selectedSkills` contains `design-taste-frontend` with `source: "template_required"` and a hash matching the on-disk file. Verify the Codex prompt logs (internal audit only, never user-visible) show a `<selected_skill>` block.

**Acceptance Scenarios**:

1. **Given** the active init template lists `design-taste-frontend` as required and the skill is present in the registry, **When** the user submits any init prompt, **Then** the run injects the skill, records its metadata in `selectedSkills`, and never enters `awaiting_clarification`.
2. **Given** the same setup, **When** the run completes, **Then** the published workspace reflects design-taste rules (verifiable by user-facing inspection of the storefront UI), and `selectedSkills` retains `loaded: true` for the skill.
3. **Given** a run with `selectedSkills` populated, **When** an operator inspects the persisted `builder_runs` row, **Then** they see only metadata fields (`name`, `source`, `score`, `hash`, `loaded`); the raw skill body is not stored anywhere.

---

### User Story 2 — Clarification when two skills tie (Priority: P1)

A user submits a prompt where two skills score in the 50–79 candidate band with overlapping intent (e.g. two design-taste variants both apply). The deterministic detector cannot pick a winner because the score gap is below the configured threshold and at least one candidate has `clarificationPolicy: when_ambiguous`. The hybrid detector calls the LLM tie-break first; if the tie-break returns a confident pick, the run continues. If the tie-break is also ambiguous, the run pauses with `awaiting_clarification`, and the UI shows exactly one question with a small set of options. The user picks one. The run resumes from where it paused, the detector re-runs with the answer included, and the chosen skill is injected.

**Why this priority**: Without this, ambiguous prompts either silently pick the wrong skill or block the user with no recovery path.

**Independent Test**: Provision two skills with overlapping triggers in `$SKILLS_ROOT`. Submit a prompt that triggers both. Stub the LLM tie-break to return `{ tie: true }`. Verify the run pauses, `pendingSkills[]` is persisted, the SSE stream emits `awaiting_clarification`, and no draft workspace is created. Submit the user's answer to the clarification endpoint. Verify the run resumes, the chosen skill appears in `selectedSkills`, and a draft workspace is created at this point (not before).

**Acceptance Scenarios**:

1. **Given** two skills tie in the 50–79 band and the LLM tie-break returns a confident pick, **When** the run runs, **Then** the run continues without pausing and the LLM-picked skill is injected.
2. **Given** the LLM tie-break is also ambiguous, **When** the detector runs, **Then** the builder run transitions to `awaiting_clarification`, persists `pendingSkills[]` containing both candidates with their metadata, and emits a single product-safe SSE question.
3. **Given** a run is in `awaiting_clarification`, **When** the user submits an answer, **Then** the detector re-runs with original prompt + answer + pending metadata, the run resumes (draft workspace gets created at this point, not earlier), and the picked skill is logged in `selectedSkills`.
4. **Given** a run in `awaiting_clarification`, **When** the user cancels instead of answering, **Then** the run terminates with `cancelled`, no draft is created, `pendingSkills[]` is preserved for audit, and no skill is recorded as selected.

---

### User Story 3 — Codex requests an additional skill mid-turn (Priority: P2)

A Codex turn already has `design-taste-frontend` pre-injected. While reasoning, Codex decides it needs a different skill (e.g. a hypothetical `accessibility-audit` skill) to handle a sub-task. Codex calls `project_read_skill({ name: "accessibility-audit" })`. The tool loads the named skill from the registry, returns the body to Codex inline, and appends `accessibility-audit` to the run's `loadedSkills[]` audit field. The skill body never lands in persistent storage, only the name.

**Why this priority**: This unlocks self-directed skill use without forcing the app to predict every skill the run will need.

**Independent Test**: With two skills in the registry, drive a Codex turn (with a stubbed mock) that calls `project_read_skill({ name: "skill-b" })`. Verify the tool returns the body, that `loadedSkills[]` after the run includes `skill-b`, and that `selectedSkills[]` only contains the originally-injected entries (not `skill-b`).

**Acceptance Scenarios**:

1. **Given** a registered skill exists, **When** Codex invokes `project_read_skill({ name: <existing> })`, **Then** the tool returns the SKILL.md body and `loadedSkills[]` records the name (not the body).
2. **Given** Codex requests a skill that does not exist in the registry, **When** the tool runs, **Then** the tool returns a structured error to the Codex turn (not a full filesystem error) and the audit log records `skill_load_failed` with the requested name.
3. **Given** Codex tries to read a path that escapes the registry root (e.g. `..` or absolute), **When** the tool resolves the name, **Then** the request is rejected with the same structured error and a `boundary_violation`-flavoured internal audit entry. Codex never receives filesystem details.

---

### User Story 4 — Required skill missing fails fast (Priority: P1)

The active init template lists a `requiredSkills: [some-skill]` entry, but `$SKILLS_ROOT/some-skill/SKILL.md` is missing or unreadable. The run aborts before any draft workspace is created or any Codex turn runs, with internal event `required_skill_unavailable` and a localized user-facing error. Operators get enough internal-audit detail to fix the registry; the user sees only a safe, actionable message.

**Why this priority**: Silently degrading would let runs ship without the contractually required skill.

**Independent Test**: Configure `$SKILLS_ROOT` so a referenced required skill is missing. Submit any prompt that activates the affected template. Verify: no draft is created, no Codex thread starts, the run is marked failed with code `required_skill_unavailable`, the SSE stream emits a single failed event with the localized Vietnamese-primary message ("Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent."), and the internal audit metadata includes the missing skill name.

**Acceptance Scenarios**:

1. **Given** a `requiredSkills` entry that is missing in `$SKILLS_ROOT`, **When** any builder run starts, **Then** the run aborts before draft creation and emits `required_skill_unavailable` internally and a localized user-facing failure.
2. **Given** a `recommendedSkills` entry that is missing, **When** the run starts, **Then** the run continues, logs a warning internally, and the recommended skill is omitted from `selectedSkills`.
3. **Given** the user explicitly mentions a skill by name or alias that does not exist, **When** the detector resolves the prompt, **Then** the run aborts with a clear "skill X is unavailable" message inline in the prompt UI; no draft is created.

---

### User Story 5 — Skill registry boots cleanly with malformed entries (Priority: P2)

On app startup, the loader scans `$SKILLS_ROOT`. One subdirectory has a corrupt frontmatter, another has no `SKILL.md`, a third is symlinked outside the root. The valid skills load, the invalid ones are skipped with warnings, and the app boots normally. The Codex feature stays available unless the broken skill is needed at runtime.

**Why this priority**: Startup must be resilient. A single bad SKILL.md cannot take the whole app offline.

**Independent Test**: Drop a malformed `SKILL.md` (broken YAML), an empty subdirectory, and a symlinked subdirectory in a test `$SKILLS_ROOT`. Boot the app. Verify the loader emits `skill_registry_loaded` with the count of valid skills, individual `skill_load_failed` entries for each invalid one, and the Codex feature flag remains `available`. The app responds to other endpoints normally.

**Acceptance Scenarios**:

1. **Given** a `$SKILLS_ROOT` containing 1 valid skill + 2 broken entries, **When** the app boots, **Then** the registry exposes only the valid skill and logs `skill_load_failed` for each broken entry.
2. **Given** a symlinked entry pointing outside `$SKILLS_ROOT`, **When** the loader runs, **Then** the entry is skipped with a `boundary_violation`-flavoured internal log and never read.
3. **Given** an empty `$SKILLS_ROOT` (zero skills), **When** the app boots, **Then** the registry is empty, the runtime continues to operate, and any builder run that does not depend on `requiredSkills` runs successfully.

---

### Edge Cases

- A skill defines `clarificationPolicy: always_before_apply` even though the prompt is unambiguous → the run still pauses with `awaiting_clarification`.
- A skill defines `clarificationPolicy: never` and ambiguity arises → the detector picks the higher-scored candidate without asking; if a true tie remains after LLM tie-break, the run continues with the first by deterministic ordering.
- The LLM tie-break call fails (provider down, timeout) → the detector falls back to user clarification rather than silently picking; the run pauses.
- A skill's frontmatter declares an unsupported `clarificationPolicy` value → the loader treats the skill as malformed and skips it on startup.
- `requiredSkills` exceeds `maxSelectedSkills = 3` → all required skills are still injected (required overrides limit), and a warning is logged.
- Two skills declare the same `name` → only the first one wins; the second logs `skill_load_failed` with reason `duplicate_name`.
- The user explicitly mentions a skill that exists but is below the candidate threshold → explicit user mention bumps the score (+80) so it survives, regardless of base detection.
- A skill body exceeds the configured `MAX_SKILL_CHARS` cap → the loader truncates with a clear in-context marker; the audit hash is taken over the truncated content.
- A run cancelled while in `awaiting_clarification` → no draft is created, `pendingSkills[]` is preserved for audit, internal log records `clarification_cancelled`.
- The user submits an empty answer to a clarification → the run treats it as ambiguous-still and either re-runs detection or remains paused (the spec requires a non-empty answer; UX must surface this requirement).

## Requirements *(mandatory)*

### Functional Requirements

#### Skill registry & loader

- **FR-001**: System MUST scan `$SKILLS_ROOT` at app startup, load every valid `<name>/SKILL.md`, and build an in-memory registry keyed by skill name.
- **FR-002**: Loader MUST parse YAML frontmatter supporting fields: `name` (string, required, must match the directory name), `description` (string), `aliases` (string array), `triggers` (string array), `asksClarification` (boolean), `clarificationPolicy` (enum: `never` | `when_ambiguous` | `always_before_apply`), `appliesTo` (string array).
- **FR-003**: Loader MUST skip individual skills that fail to parse (malformed YAML, missing `name`, name mismatch with directory, unsupported `clarificationPolicy` value, symlinks pointing outside `$SKILLS_ROOT`) and continue loading remaining skills. Each failure logs `skill_load_failed` with the reason.
- **FR-004**: Two skills sharing a `name` MUST result in the first-loaded one being kept; subsequent ones MUST be skipped with reason `duplicate_name`.
- **FR-005**: Skill content larger than `MAX_SKILL_CHARS` (configurable, default 32k characters) MUST be truncated with a clear in-skill marker; the audit hash MUST be computed over the truncated content.
- **FR-006**: System MUST NOT hot-reload skills during a running process. A `SKILL.md` change requires app restart to take effect.
- **FR-007**: An empty `$SKILLS_ROOT` (zero skills present) MUST NOT prevent app startup or builder-run execution unless a run requires a missing skill.

#### Active-template scanner

- **FR-008**: Template scanner MUST collect `requiredSkills` and `recommendedSkills` declarations from frontmatter and inline `@skill:<name> required` / `@skill:<name> recommended` directives in only these active prompt templates: `templates/codex-builder/foundation/edit-system.md`, `templates/codex-builder/init/system.md`, `templates/codex-builder/recovery/*.md`, `templates/codex-builder/redesign/*.md`. Other markdown files under `templates/` MUST NOT be scanned.
- **FR-009**: Scanner MUST refuse to declare a skill it has not loaded into the registry. Required entries referring to missing skills MUST surface as `required_skill_unavailable` at run time, not at startup.

#### Detector (deterministic + hybrid LLM tie-break)

- **FR-010**: Detector MUST compute a per-skill score for each candidate per run using exactly this matrix: template `requiredSkills` `+100`, explicit user mention by `name` or any `alias` `+80`, template `recommendedSkills` `+60`, exact `triggers` phrase match in prompt `+25`, `description` keyword cluster match `+15`, `appliesTo` context match against the run's project/task type `+10`. A skill MAY accumulate from multiple sources.
- **FR-011**: Detector MUST apply these thresholds: score `>= 80` is auto-included; score `50–79` is a candidate; score `30–49` carries metadata only (passed to the thinking layer for context but not injected); score `< 30` is ignored.
- **FR-012**: Detector MUST cap the number of injected skills at `maxSelectedSkills = 3` per run, EXCEPT required skills, which MUST always be injected even if they exceed the cap (a warning is logged).
- **FR-013**: When two candidates fall in the 50–79 band and their score gap is `<= 10` points, detector MUST issue an LLM tie-break call passing skill metadata only (`name`, `description`, `aliases`, `triggers`, `score`, `appliesTo`). The tie-break MUST NOT receive `SKILL.md` content.
- **FR-014**: If the LLM tie-break fails (timeout, provider error, schema mismatch), detector MUST escalate to user clarification rather than silently picking a winner.
- **FR-015**: If the LLM tie-break returns an ambiguous response (e.g. `tie: true` or low confidence below a threshold), detector MUST escalate to user clarification.
- **FR-016**: Explicit user mention of a skill by `name` or `alias` in the prompt MUST always bump that skill's score by `+80` regardless of any other source.

#### Clarification flow

- **FR-017**: When the active template, the detector, or any selected skill triggers clarification (per `clarificationPolicy: when_ambiguous` with detector ambiguity, or `clarificationPolicy: always_before_apply`), the builder run MUST pause with milestone `awaiting_clarification` BEFORE creating a draft workspace and BEFORE starting any Codex thread.
- **FR-018**: When pausing for clarification, the run MUST persist `pendingSkills[]` in `builder_runs.metadata`, where each entry includes `name`, `source`, `score`, and `reason`.
- **FR-019**: SSE stream MUST emit exactly one `awaiting_clarification` event containing a single product-safe question and a bounded set of options (3–4 max). The event MUST NOT leak raw prompt content or `SKILL.md` body.
- **FR-020**: System MUST expose `POST /api/projects/$projectId/builder-runs/$runId/answer` accepting a single answer payload (`{ optionId?: string, freeText?: string }`). Submitting an answer MUST atomically resume the run and re-run the detector with `originalPrompt + answer + pendingSkills metadata`.
- **FR-021**: On clarification rerun, pending required and explicit-user-mentioned skills MUST receive their high-priority score so they survive the rerun. The detector MUST NOT detect skills purely from the clarification answer's free text.
- **FR-022**: A run cancelled while paused in `awaiting_clarification` MUST terminate with `cancelled`, retain `pendingSkills[]` for audit, and never create a draft.
- **FR-023**: An empty or whitespace-only answer MUST be rejected by the API with a structured error (`{ ok: false, code: "empty_answer", message }`); the run remains paused.

#### Skill injection

- **FR-024**: Every selected skill MUST be wrapped in `<selected_skill name="..." version="..." hash="..." source="..." score="...">…SKILL.md body…</selected_skill>` in the Codex context bundle. The wrapper MUST be a drop-in replacement at the same slot used by Phase 1's `<selected_instruction>` wrapper.
- **FR-025**: System MUST emit `<selected_skill>` blocks in deterministic order: required skills first, then candidates by descending score, then the polish slot. Order MUST be reproducible run-to-run for the same input.
- **FR-026**: System MUST stamp each `<selected_skill>` with the SHA-256 hash of the post-truncation skill body so the run can be replayed against a known content version.

#### `project_read_skill` tool

- **FR-027**: System MUST expose `project_read_skill({ name: string })` to the Codex thread via the SDK config layer. The tool MUST resolve the name through the in-memory registry only; it MUST NOT touch the filesystem outside that boundary.
- **FR-028**: `project_read_skill` MUST return the registered skill body (post-truncation) when the name resolves and the registry is healthy.
- **FR-029**: `project_read_skill` MUST return a structured error to Codex when the name does not resolve, the skill failed to load at boot, or the name attempts to escape the registry (e.g. contains `..`, path separators, or absolute paths). The error MUST NOT leak filesystem detail. The audit log MUST record `skill_load_failed` with the requested name.
- **FR-030**: System MUST append every successful `project_read_skill` call's skill name to the run's `loadedSkills[]` audit field. The skill body MUST NOT be persisted.
- **FR-031**: `project_read_skill` MUST NOT grant additional filesystem access. It must not satisfy a Codex request to read arbitrary paths.

#### Required-vs-recommended failure semantics

- **FR-032**: If a `requiredSkills` entry references a skill that is missing from the registry (or failed to load at boot), the run MUST abort before draft creation, emit internal event `required_skill_unavailable`, and emit a single failed event with the localized message: Vietnamese primary "Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent.", English fallback "Cannot continue because a required agent instruction is unavailable."
- **FR-033**: If a `recommendedSkills` entry is missing, the run MUST continue, log internally that the skill was unavailable, and omit the skill from `selectedSkills`.
- **FR-034**: If the user explicitly mentions a skill that is not in the registry, the API MUST reject the run creation request with `{ ok: false, code: "skill_unavailable", message: "<localized> skill X is not available", missing: ["X"] }` before any run row is created. No draft is created.

#### Run metadata & audit

- **FR-035**: Builder run records MUST add `selectedSkills[]` with shape `{ name, source: "template_required" | "template_recommended" | "explicit_user" | "detected", score, hash, loaded }`. Coexists with the existing `selectedInstructions[]` field.
- **FR-036**: Builder run records MUST add `pendingSkills[]` with shape `{ name, source, score, reason }`. Set only while paused in `awaiting_clarification`; preserved for audit afterwards.
- **FR-037**: Builder run records MUST add `loadedSkills[]` containing only the names of skills loaded via `project_read_skill` during the run. No bodies, no metadata.
- **FR-038**: System MUST NOT persist any raw `SKILL.md` body in any DB column or log. Only the audit hash, name, source, score, and `loaded` flag may be stored.
- **FR-039**: Audit metadata MUST include `skill_registry_loaded` (with skill count) at boot, `skill_selected` per inclusion, `skill_load_failed` per failure, and `skill_injected` per `<selected_skill>` block emitted.

#### API surface

- **FR-040**: `POST /api/projects/$projectId/builder-runs/$runId/answer` MUST be the only path to resume a run from `awaiting_clarification`. The endpoint MUST return `{ ok: true }` on success and a structured error per `{ ok: false, code, message }` on every failure mode.
- **FR-041**: The existing builder-runs SSE stream MUST add `awaiting_clarification` to its milestone enum and emit it as a normal milestone event. Failure events for skills MUST use the existing `failed` event with `failureCode: "required_skill_unavailable"` (added) or `failureCode: "skill_unavailable"` (added) per Phase 1's failure taxonomy.

#### Schema migration

- **FR-042**: Drizzle migration MUST add `selectedSkills json()` and `pendingSkills json()` to `builder_runs`, plus `loadedSkills json()` (defaults to `[]` on insert). Existing `selectedInstructions[]` and `pendingInstructions[]` columns remain unchanged.

#### Seed skill

- **FR-043**: System MUST provision `$SKILLS_ROOT/design-taste-frontend/SKILL.md` on rollout. Frontmatter MUST include `name: design-taste-frontend`, a non-empty `description`, `aliases: [taste skill, anti-slop]`, `triggers` covering `redesign`, `premium UI`, `storefront UI`, `asksClarification: true`, `clarificationPolicy: when_ambiguous`, `appliesTo: [init_project, design_update, ui_mutation]`.
- **FR-044**: The active init template (`templates/codex-builder/init/system.md`) MUST declare `requiredSkills: [design-taste-frontend]` after Phase 2 ships, ensuring every init run injects the skill.

#### Configuration

- **FR-045**: `$SKILLS_ROOT` env var MUST default to `process.cwd()/skills` in development and `/var/bin/skills` in production. Phase 2 MUST consume this env (Phase 1 only reserved it).
- **FR-046**: `MAX_SKILL_CHARS` MUST be configurable via env (default 32000). `LLM_TIE_BREAK_GAP` MUST be configurable via env (default 10). `MAX_SELECTED_SKILLS` MUST be configurable via env (default 3).
- **FR-047**: LLM tie-break MUST reuse the existing Codex provider config (base URL, API key, model) — no new provider integration. The tie-break call uses structured-output mode with a small bounded JSON schema.

### Key Entities

- **Skill**: A single registry entry. Owns frontmatter metadata (`name`, `description`, `aliases[]`, `triggers[]`, `asksClarification`, `clarificationPolicy`, `appliesTo[]`) and the post-truncation `SKILL.md` body. Identified globally by `name`.
- **SelectedSkill**: A per-run record indicating that a skill was injected into the Codex context bundle. Stores `name`, `source`, `score`, `hash`, `loaded`. Body is never persisted.
- **PendingSkill**: A per-run record indicating that a skill is awaiting clarification before injection. Stores `name`, `source`, `score`, `reason`. Cleared once the run resumes and the detector picks a winner; preserved for audit on cancel.
- **SkillRegistry**: The in-memory, boot-time map keyed by skill `name`. Read-only at runtime. Sources content from `$SKILLS_ROOT`.
- **TemplateScanResult**: A boot-time and per-run snapshot of which active templates declared which `requiredSkills` / `recommendedSkills`. Used by the detector.
- **DetectorOutcome**: Per-run output of the deterministic-plus-hybrid detector. Includes the picked skills, the candidate set, the per-source scoring breakdown, whether tie-break ran, and whether clarification was triggered.
- **ClarificationPrompt**: A product-safe question + 3–4 bounded options + free-text fallback. Emitted via SSE; stored alongside the run's `pendingSkills[]` for audit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of init runs whose active template declares `requiredSkills: [design-taste-frontend]` end with `selectedSkills` containing that skill and a hash matching the on-disk file. (Verifiable from `builder_runs` metadata.)
- **SC-002**: Zero `<selected_skill>` block reaches user-visible UI or persisted DB columns containing raw skill body. (Verifiable by inspection of audit dumps and SSE traces.)
- **SC-003**: A run paused in `awaiting_clarification` resumes within 30 seconds of receiving a valid answer in 99% of cases. (Verifiable by per-run latency telemetry.)
- **SC-004**: Zero successful runs occur when a `requiredSkills` entry is missing from the registry. Every such run aborts with `required_skill_unavailable` before any draft workspace exists on disk. (Verifiable by audit log + draft-directory inventory.)
- **SC-005**: A registry containing 1 valid + 2 broken skill entries boots cleanly with the valid skill registered and the app responding to non-builder endpoints normally. (Verifiable by integration test.)
- **SC-006**: An LLM tie-break call fires only when two candidates fall in the 50–79 band with `<= 10` point gap. Across 100 simulated runs covering the standard prompt corpus, tie-break fires no more than 5% of the time. (Verifiable by detector replay against test corpus.)
- **SC-007**: `project_read_skill` rejects every name attempting `..`, absolute paths, or unloaded skills with a structured error. Across 50 adversarial calls, zero leaks of filesystem detail to Codex. (Verifiable by tool boundary test.)
- **SC-008**: `selectedInstructions[]` and `selectedSkills[]` coexist on the same run without one overriding or clobbering the other; foundation templates that have not been migrated continue to inject via `<selected_instruction>` while skill-driven blocks inject via `<selected_skill>`. (Verifiable by inspection of a run's audit dump.)
- **SC-009**: Phase 2 changes do NOT modify the legacy AI Agent UI (`src/routes/projects/$projectId.tsx` and siblings) and do NOT delete any file under `src/features/ai-agent/*`. (Verifiable by `git diff --stat HEAD~ HEAD` after the feature lands.)
- **SC-010**: Activating Phase 2 adds at most one Drizzle migration and does not require any schema rollback path; existing `builder_runs` rows continue to read normally with the new JSON columns defaulting to empty arrays. (Verifiable by migration replay against a populated DB.)

## Assumptions

- The Codex SDK provider config (base URL, API key, model) is reachable from the LLM tie-break code path. If the provider is unavailable, FR-014 forces fallback to user clarification.
- `$SKILLS_ROOT` and its contents are owned by the same OS user that runs the cloud-ai builder process. No multi-user / multi-tenant isolation is required at the directory level.
- Skill `description` keyword cluster matching uses a deterministic tokenizer (whitespace + lowercase + stop-word filter); the exact token list is an implementation detail and does NOT belong in the spec.
- The "design-taste-frontend" SKILL.md content delivered with this feature is effectively the design-taste content already used in Phase 1 foundation templates, ported into the new format. Operators may further refine the body in follow-up commits.
- Builder run cancellation semantics (FR-022) reuse the cancel path delivered in Phase 1 (`/builder-runs/$runId/cancel`); no new cancel endpoint is needed.
- The hybrid LLM tie-break consumes a small fixed token budget (≤ 1k input tokens) per ambiguous run. This is well below any Phase 1 token-usage logging behavior; Phase 2 does not introduce a token budget either.
- Phase 1's milestone enum is extended additively with `awaiting_clarification`; existing UI fallback for unknown milestones already renders something safe.
- The constitution's Principle II (test for every business rule) is satisfied by table-driven detector tests, mock-LLM tie-break tests, registry boot tests, and clarification round-trip tests delivered alongside this feature.
