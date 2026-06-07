# Research — Generic Skill Runtime (Phase 2)

**Status**: All `[NEEDS CLARIFICATION]` markers resolved before this document. The clarification round preceding the spec locked all four major decision branches (detector dispatch, clarification UX, scope, tool surface). This document captures the supporting research for ancillary decisions.

## R-001: YAML frontmatter parser

**Decision**: Use `js-yaml` (already in `package.json` dependencies) with a strict zod schema layered on top to validate the parsed object before it lands in the registry.

**Rationale**: Project already depends on `js-yaml` (v4). Adding a second YAML lib doubles surface area without value. zod is the project-standard validation layer (`@/server/env/codex.ts` uses it) so reusing it keeps validation idiomatic. Strict schema (no `passthrough`) makes the loader fail-fast on unknown fields, which surfaces typos early.

**Alternatives considered**:
- Hand-rolled `--- ... ---` parser — tempting because the schema is small, but YAML edge cases (multi-line strings, anchors, escaped characters) are easy to get wrong and would silently corrupt skill metadata.
- `yaml` (eemeli/yaml) — more spec-compliant but adds a dependency for marginal benefit.

## R-002: Skill content size cap

**Decision**: Default `MAX_SKILL_CHARS = 32000` characters (≈ 8k tokens at 4 chars/token), env-overridable.

**Rationale**: Phase 1 grill summary (`docs/codex-sdk-migration-grill-summary.md`) noted the legacy taste-skill body was ~28k chars; 32k gives headroom for normal evolution. Combined with `MAX_SELECTED_SKILLS = 3`, max injected skill content per run is ≈ 96k chars (~24k tokens), well within Codex SDK's input window. Truncation marker placed in-body (`\n\n... [truncated by skill loader] ...`) so the audit hash covers the truncated content (FR-005).

**Alternatives considered**:
- No cap — risks runaway prompt size from a misedited SKILL.md.
- Hard cap of 16k — too tight; design-taste-frontend itself is ~28k.
- Cap by token count via tokenizer — adds tokenizer dep + cost; char cap is a reasonable proxy and easier to audit.

## R-003: Tie-break LLM call

**Decision**: Reuse the existing Codex SDK `Codex({ apiKey, baseUrl, model })` instance to make a single `run()` turn with structured output schema `{ pick: string | null, confidence: number, reason: string }` and a small bounded prompt (≤ 1k input tokens). The call uses the same model as the run's main Codex thread.

**Rationale**: Phase 1 already wraps the SDK in `codex-thread.server.ts` and the env config (`CODEX_HOME`, `CODEX_API_KEY`, `CODEX_MODEL`) flows through `getCodexEnv()`. Building a separate provider for tie-break would duplicate config and create a second secret surface. The Codex SDK's `outputSchema` option (per its README) lets us require structured JSON, eliminating the parsing-failure failure mode.

**Alternatives considered**:
- A separate `openai` SDK client — adds a second auth + a second config knob.
- No structured output (free-text response) — needs a regex parser, brittle, easy to get `tie: true` wrong.

**Tunables**: `LLM_TIE_BREAK_GAP` (default 10) — only fire tie-break when top-2 candidates are within this many points in the 50-79 band.

## R-004: Active-template scanner sources

**Decision**: Scan exactly four template families:
- `templates/codex-builder/foundation/edit-system.md`
- `templates/codex-builder/init/system.md`
- `templates/codex-builder/recovery/*.md`
- `templates/codex-builder/redesign/*.md`

**Rationale**: These four are the templates that get rendered into Codex prompts during a builder run (per Phase 1 `context-builder.server.ts`). Other markdown files under `templates/` are static reference (e.g. project-rules) and never touch a Codex turn directly. Scanning them would be wasted work AND would surprise operators who edit project-rules without expecting skill-detection to react.

**Alternatives considered**:
- Scan all `templates/**/*.md` — over-broad; project-rules files would be force-coupled with the skill registry.
- Scan dynamically from manifest only (`templates/codex-builder/init/manifest.json`) — too narrow; foundation/recovery/redesign aren't in any manifest.

## R-005: Inline `@skill:<name>` directive grammar

**Decision**: Inline directives are recognised as standalone lines matching `^@skill:([a-z][a-z0-9-]+)\s+(required|recommended)\s*$`. They may appear anywhere in a template body. Frontmatter declarations and inline directives are merged with frontmatter taking precedence on conflict.

**Rationale**: A regex grammar for inline directives keeps the scanner stateless and predictable. `^...$` per-line matching avoids accidental mid-paragraph triggers from prose like "the @skill prefix means...". Lowercase + hyphen names match the directory naming convention from the design summary.

**Alternatives considered**:
- HTML-comment markers (`<!-- skill: x required -->`) — works but not what the design summary specified.
- JSON-block sentinels — overkill for inline.

## R-006: Builder run state machine extension

**Decision**: Add `awaiting_clarification` as a new milestone between `loading_context` and `creating_draft`. The run pauses there with the abort controller still armed (so cancel works) but no Codex thread spun up. On answer, the run continues forward to `creating_draft`. On cancel, the run terminates with `cancelled`.

**Rationale**: Phase 1's `BuilderRunMilestone` enum is order-stable and the existing UI fallback for unknown milestones is benign — adding a new milestone is forward-compatible. Pausing BEFORE draft creation is critical for two reasons: (a) it avoids a draft directory leak if the user never answers; (b) it preserves the invariant that a draft directory exists ⇒ the orchestrator has fully committed to a skill set.

**Alternatives considered**:
- Pause AFTER draft creation — leaks a draft on every clarification ask, requires retention sweep to clean it up.
- Pause as a separate "clarifying" run kind — over-modeled, doubles the API surface.

## R-007: Schema migration shape

**Decision**: Single Drizzle migration adds three columns to `builder_runs`:
- `selectedSkills json() NOT NULL DEFAULT '[]'`
- `pendingSkills json() NOT NULL DEFAULT '[]'`
- `loadedSkills json() NOT NULL DEFAULT '[]'`

`selectedInstructions[]` and `pendingInstructions[]` from Phase 1 stay untouched. Both pairs coexist on the same row.

**Rationale**: Constitution IX requires `json()` (not `jsonb()`). Default `[]` keeps existing rows readable without rewrite. Adding parallel columns is cheaper than overloading the existing instruction columns with skill-typed data — keeps query semantics simple ("which runs used skill X?" → `WHERE selectedSkills @> '[{"name":"X"}]'::json`).

**Alternatives considered**:
- Reuse `selectedInstructions[]` for both — type-narrow nightmares; loses the audit distinction between template-baked content and registry-driven skill content.
- Single new `skillsState json()` column with a nested shape — flatter columns query better.

## R-008: `project_read_skill` tool registration

**Decision**: Register the tool through Codex SDK's tool config layer (`Codex({ tools: [...] })` at thread construction). The tool handler runs in the app process and resolves names through the in-memory registry; it never spawns subprocesses or reads disk paths beyond what `registry.getSkill()` exposes.

**Rationale**: Codex SDK supports custom tools via the SDK config (per its `dist/index.d.ts` `CodexOptions.config` and the `mcp_tool_call` event surface). In-process resolution is mandatory because the registry lives in app memory; the tool MUST NOT shell out or hit the filesystem directly (FR-031).

**Alternatives considered**:
- File-path tool (`{ path: string }`) — explicitly rejected by spec FR-031.
- Out-of-process MCP server — adds deploy complexity for zero functional gain in Phase 2.

## R-009: Vietnamese-primary UX strings

**Decision**: All user-visible clarification copy is Vietnamese-primary; English strings are kept as a parallel `BUILDER_RUN_LOCALE_EN` map for future locale switching. The single-question prompt format mirrors Phase 1's `BuilderRunProgress` messaging style: short imperative, 3–4 button options, optional free-text fallback.

**Rationale**: Phase 1 established Vietnamese-primary as the project default (memory `MEMORY.md` + Phase 1 spec). Maintaining the parallel `_EN` map costs almost nothing and avoids a future migration when locale switching becomes a feature.

## R-010: Test boundary between unit and integration

**Decision**:
- Unit tests cover frontmatter parsing, registry boot resilience, deterministic detector matrix, `<selected_skill>` wrapper format, and `project_read_skill` tool boundary in isolation (mocked filesystem when relevant).
- Integration tests cover the three full lifecycle paths: (1) skill clarification flow paused → answered → resumed → injected, (2) required-skill missing → fail-fast before draft, (3) tie-break LLM unavailable → escalate to user clarification.

**Rationale**: Same split as Phase 1. Keeps detector / parser tests fast (no Codex SDK boot) while integration tests exercise the orchestration around `builder-run.server.ts`.

## R-011: Seed skill content provenance

**Decision**: Port the existing design-taste-frontend SKILL content used in Phase 1 foundation templates into the new `$SKILLS_ROOT/design-taste-frontend/SKILL.md` format. Strip the parts already covered by other `templates/codex-builder/foundation/*.md` files to avoid double-injection.

**Rationale**: The current foundation prompts already deliver design-taste behaviour. Phase 2 doesn't need new content; it needs the skill mechanism. Existing content + new wrapper = same prompt result, different lifecycle.

**Alternatives considered**:
- Author fresh design-taste copy — out-of-scope content work; extends Phase 2 timeline.
- Leave foundation templates untouched — would cause double-injection (foundation block + skill block) on every init.
