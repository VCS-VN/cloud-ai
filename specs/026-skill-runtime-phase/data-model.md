# Data Model — Generic Skill Runtime (Phase 2)

**Status**: Phase 2 only ADDS to the Phase 1 `builder_runs` row shape. No existing column is renamed, dropped, or repurposed.

## Schema delta

### `builder_runs` — three new JSON columns

```
selectedSkills   json  NOT NULL  DEFAULT '[]'
pendingSkills    json  NOT NULL  DEFAULT '[]'
loadedSkills     json  NOT NULL  DEFAULT '[]'
```

All other Phase 1 columns (`selectedInstructions`, `pendingInstructions`, `metadata`, etc.) remain unchanged. Constitution IX requires `json()` not `jsonb()`.

## Entity shapes

### `SelectedSkill` — entries in `selectedSkills[]`

Persisted on every run that injects a skill into the Codex context bundle.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Globally unique skill identifier; lowercase + hyphens; matches the directory name in `$SKILLS_ROOT`. |
| `source` | enum | yes | One of: `template_required`, `template_recommended`, `explicit_user`, `detected`. Records why the skill was picked. |
| `score` | number | yes | Final detector score (post-rerun if clarification happened). Used for ordering and audit. |
| `hash` | string (hex SHA-256, 64 chars) | yes | Hash of the post-truncation skill body. Used for replay-against-content versioning. |
| `loaded` | boolean | yes | Always `true` for entries in `selectedSkills[]` (the skill body was injected). Field exists for forward-compat with future deferred-load semantics. |

**Validation rules**:
- `name` must be present in the registry at the moment the field is written.
- `score` must be ≥ 80 for required entries, ≥ 50 for non-required entries (anything lower would not have been picked).
- `hash` must match the registry's stored hash for the same `name` at write time. Drift indicates the registry was reloaded mid-run (impossible given the boot-time-only contract, FR-006) or a bug.

### `PendingSkill` — entries in `pendingSkills[]`

Set only while the run is paused in `awaiting_clarification`. Preserved for audit if the run is cancelled before answering.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Candidate skill name. |
| `source` | enum | yes | Same enum as `SelectedSkill.source`. |
| `score` | number | yes | Score the candidate had at the moment ambiguity was detected. |
| `reason` | string | yes | One of: `tie_break_ambiguous`, `tie_break_failed`, `policy_always_before_apply`, `policy_when_ambiguous_user_choice`. Records why the candidate is pending instead of selected. |

**Lifecycle**:
- Written when the selection orchestrator escalates to user clarification.
- Cleared (set to `[]`) when the user answers and the detector reruns successfully — replaced by the rerun's `selectedSkills`.
- Preserved on cancel: the run terminates with `cancelled` and `pendingSkills[]` stays for audit.

### `LoadedSkill` — entries in `loadedSkills[]`

Per-run audit list of skill **names** that the Codex turn pulled via `project_read_skill({ name })`. Names only — never bodies, never metadata.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Resolved skill name. |
| `at` | number (epoch ms) | yes | Timestamp of the tool call. |

**Validation rules**:
- `name` must resolve in the registry at tool-call time. Failed lookups go to the audit log as `skill_load_failed` and DO NOT add to `loadedSkills[]`.
- Order in the array reflects call order (no de-dup; if Codex calls `project_read_skill({name:"x"})` twice, two entries appear).

## Registry shapes (in-memory only — not persisted)

### `Skill`

The unit the loader produces and the registry stores per file.

| Field | Type | Notes |
|---|---|---|
| `name` | string | From frontmatter; must match directory name. |
| `description` | string | From frontmatter. |
| `aliases` | string[] | From frontmatter. Default `[]`. |
| `triggers` | string[] | From frontmatter. Default `[]`. |
| `asksClarification` | boolean | From frontmatter. Default `false`. |
| `clarificationPolicy` | enum | One of: `never`, `when_ambiguous`, `always_before_apply`. Default `never`. |
| `appliesTo` | string[] | From frontmatter. Default `[]`. |
| `body` | string | Post-truncation SKILL.md body (frontmatter stripped). |
| `hash` | string | SHA-256 of `body`. |
| `truncated` | boolean | Whether the loader had to cut at `MAX_SKILL_CHARS`. |
| `version` | string | Phase 2 default `"1.0.0"` (read from frontmatter when authors add it). |

**Validation rules** (enforced by zod at parse time):
- `name` matches `^[a-z][a-z0-9-]*$` and equals the parent directory name.
- `clarificationPolicy` must be one of the three enum values; unknown values cause the skill to be skipped.
- `aliases`, `triggers`, `appliesTo` are string arrays of non-empty strings.

### `TemplateScanResult`

Boot-time and per-run snapshot of the active templates' skill declarations.

| Field | Type | Notes |
|---|---|---|
| `templatePath` | string | Absolute path to the scanned template. |
| `requiredSkills` | string[] | Skill names declared as `required` (frontmatter or inline). |
| `recommendedSkills` | string[] | Skill names declared as `recommended` (frontmatter or inline). |

**Validation rules**:
- Skill name must match `^[a-z][a-z0-9-]*$`. Names not present in the registry surface as `required_skill_unavailable` at run time (FR-009), not at scan time.

### `DetectorOutcome`

Per-run output from the selection orchestrator.

| Field | Type | Notes |
|---|---|---|
| `picked` | SelectedSkill[] | Skills that pass the auto-include threshold or survive tie-break with a winner. |
| `pending` | PendingSkill[] | Empty unless clarification escalated. |
| `candidates` | { name: string, score: number, sources: { source, score }[] }[] | All candidates with their per-source score breakdown for audit. |
| `tieBreakInvoked` | boolean | True if the LLM tie-break call fired. |
| `clarificationRequired` | boolean | True if the run must pause. |

## Relationships

```
$SKILLS_ROOT/{name}/SKILL.md  ─┐
                               │  loaded at boot →
templates/codex-builder/...  ──┤  scanned at boot/run →
                               │
                               ▼
                        SkillRegistry (in-memory)
                               │
                               ▼
                        Detector + tie-break
                               │
                               ├─ picked  → builder_runs.selectedSkills[]
                               │           → context-builder injects <selected_skill>
                               ├─ pending → builder_runs.pendingSkills[]
                               │           → SSE awaiting_clarification + UI prompt
                               │           ← user answer → re-run → picked
                               │
                               └─ Codex turn calls project_read_skill(name)
                                       → registry lookup
                                       → builder_runs.loadedSkills[] += name
                                       → tool returns body to Codex
```

## State transitions

### Builder run lifecycle (Phase 2 additions)

Phase 1 milestones (unchanged): `loading_context → planning → creating_draft → building_pages → checking_preview → repairing? → publishing → done`.

Phase 2 inserts an optional pause between `loading_context` and `creating_draft`:

```
loading_context
    │
    ├─ selection orchestrator runs
    │   ├─ deterministic detector
    │   ├─ tie-break (if tight ambiguity)
    │   └─ clarification gate (clarificationPolicy)
    │
    ├─ if all selected: continue ────────────► creating_draft → ...
    │
    └─ if pending: ─► awaiting_clarification (paused, no draft)
                          │
                          ├─ POST /answer    ► loading_context (re-run detector)
                          └─ POST /cancel    ► cancelled (preserve pendingSkills audit)
```

Failure transitions added to Phase 1's failure taxonomy:

- `failed | failureCode = required_skill_unavailable` — emitted before draft creation when a `requiredSkills` entry from an active template is missing in the registry.
- `failed | failureCode = skill_unavailable` — emitted in API response when a user-explicit-mentioned skill is not in the registry; never reaches `builder_runs` row.

## Forward-compat note

`selectedInstructions[]` (Phase 1) and `selectedSkills[]` (Phase 2) coexist on the same row. Phase 1 foundation templates that have not yet been migrated continue to inject via `<selected_instruction>`; skill-driven blocks inject via `<selected_skill>`. Migration of foundation content into skills happens incrementally in follow-up PRs, one foundation block at a time.
