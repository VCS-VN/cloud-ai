# Contract: Codex tool — `project_read_skill`

**Status**: NEW Codex SDK tool (Phase 2). Lets the active Codex turn fetch additional skill content from the registry on demand without escaping the registry boundary.

## Tool registration

The tool is registered through Codex SDK's tool config layer at `Codex` thread construction time in `codex-thread.server.ts`. It runs in the same app process as the builder runtime and resolves names through the in-memory `SkillRegistry` only.

## Input schema

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Skill name. Must match a registered skill in the in-memory registry."
    }
  },
  "required": ["name"],
  "additionalProperties": false
}
```

## Behavior — happy path

1. Validate `name` against the regex above.
2. Look up the skill in the registry via `registry.getSkill(name)`.
3. If found, append `{ name, at: Date.now() }` to the run's `loadedSkills[]`.
4. Return the skill body to the Codex turn.

### Output (success)

```json
{
  "ok": true,
  "name": "<skill-name>",
  "version": "<frontmatter version>",
  "hash": "<sha256 of body>",
  "body": "<post-truncation SKILL.md body>"
}
```

## Behavior — failure modes

### Name not in registry

```json
{
  "ok": false,
  "code": "not_found",
  "message": "Skill is not available."
}
```

Internal audit: `skill_load_failed` with reason `not_found` and the requested name.

### Name fails validation (path traversal attempt)

Cases: `name` contains `/`, `\`, `..`, or starts with `/`.

```json
{
  "ok": false,
  "code": "invalid_name",
  "message": "Skill name is invalid."
}
```

Internal audit: `skill_load_failed` with reason `invalid_name`. The runtime MAY also record this as a `boundary_violation`-flavoured event for the run's violation counter (Phase 1 `recordBoundaryViolation`).

### Registry was empty at boot

```json
{
  "ok": false,
  "code": "registry_unavailable",
  "message": "Skill registry is not available."
}
```

Internal audit: `skill_load_failed` with reason `registry_unavailable`.

## Boundary guarantees

- The tool MUST resolve names through `registry.getSkill()` only. It MUST NOT touch the filesystem directly, MUST NOT spawn subprocesses, MUST NOT load anything outside the boot-time-loaded registry.
- The tool MUST NOT grant Codex any additional filesystem access. A Codex request for an arbitrary path must NEVER be satisfiable through this tool.
- The tool MUST NOT return filesystem paths in error messages. Errors are structured codes only.
- All failures append to the run's audit log; none reach the user-facing SSE stream as raw events.

## Side effects

- On success: `builder_runs.loadedSkills[]` gains an entry `{ name, at }`. Body is NOT persisted.
- On failure: no DB write, audit log entry only.

## Cache behavior

- Each `project_read_skill` call returns the registry's current body for the requested name. Since the registry is boot-time-only (FR-006), a single run sees a consistent body across all calls. Two runs in the same app boot also see the same body.
- The tool MAY be invoked multiple times for the same `name` within a single run; each call appends a fresh entry to `loadedSkills[]` (no de-dup).

## Coexistence with `<selected_skill>` injection

- A skill may be both pre-injected via `<selected_skill>` (in `selectedSkills[]`) AND read via `project_read_skill` (added to `loadedSkills[]`). The two audit fields capture different lifecycle moments and do NOT need to align.
- A skill in `selectedSkills[]` is NOT auto-added to `loadedSkills[]`; the latter is reserved for tool-driven loads only.
