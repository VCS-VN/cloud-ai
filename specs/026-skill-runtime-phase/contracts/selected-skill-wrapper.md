# Contract: `<selected_skill>` injection wrapper

**Status**: NEW context-bundle wrapper (Phase 2). Drop-in replacement at the same slot used by Phase 1's `<selected_instruction>` wrapper. The two wrappers coexist on the same context bundle.

## Wrapper format

Each entry in `selectedSkills[]` produces exactly one block in the Codex context bundle:

```text
<selected_skill name="design-taste-frontend" version="1.0.0" hash="a3f9..." source="template_required" score="100">
…post-truncation SKILL.md body…
</selected_skill>
```

### Required attributes

| Attribute | Source | Notes |
|---|---|---|
| `name` | registry | Same value as `selectedSkills[].name`. |
| `version` | registry | Frontmatter `version` field; defaults to `"1.0.0"` if author omits it. |
| `hash` | registry | Full 64-character lowercase hex SHA-256 of the post-truncation body. Same value as `selectedSkills[].hash`. |
| `source` | run state | One of `template_required`, `template_recommended`, `explicit_user`, `detected`. |
| `score` | run state | Integer score from the detector. |

### Body

- The body is the post-truncation SKILL.md content (frontmatter stripped).
- If the loader truncated, the body includes the in-content truncation marker `\n\n... [truncated by skill loader] ...` so Codex can see the cut point.
- The body MUST NOT contain `</selected_skill>` literally; if it does, the loader strips the offending characters at boot to maintain valid wrapper boundaries.

## Ordering

Skills are emitted in the context bundle in deterministic order:

1. All `source: "template_required"` skills first, in registry-name ascending order.
2. Then `source: "explicit_user"` skills, in user-mention order.
3. Then remaining `source: "template_recommended"` and `source: "detected"` skills, by descending score (ties broken by registry-name ascending).
4. Finally any post-skill polish or run-specific blocks (Phase 1 polish slot, unchanged).

## Coexistence with `<selected_instruction>`

Phase 1's `<selected_instruction>` wrapper continues to emit for foundation templates that have not been migrated to skills. Both wrappers appear in the same context bundle:

```text
<selected_instruction name="retail-foundation" source="template_required" version="1.0.0" hash="b1c2...">
…retail constraints body (Phase 1 foundation)…
</selected_instruction>

<selected_skill name="design-taste-frontend" version="1.0.0" hash="a3f9..." source="template_required" score="100">
…design-taste body (Phase 2 skill)…
</selected_skill>
```

Migration of foundation content into skills happens incrementally in follow-up PRs, one foundation block at a time. Phase 2 does NOT remove or rename `<selected_instruction>`.

## Audit hash invariant

For every emitted `<selected_skill>` block, the run's `selectedSkills[]` row MUST contain a matching entry where `hash` equals the wrapper's `hash` attribute. This invariant lets a future audit replay reconstruct exactly which skill content reached the Codex turn.

## Constraints

- `<selected_skill>` blocks are emitted only by the app-side `injection.server.ts` module. Codex turns MUST NOT generate them in their output; if a turn does, the runtime treats them as plain text (no special semantics on the return path).
- Emitted blocks count against `MAX_SKILL_CHARS` × `MAX_SELECTED_SKILLS` (default 32k × 3 = ~96k chars). Required overrides allow exceeding `MAX_SELECTED_SKILLS` count, but each individual skill body still respects `MAX_SKILL_CHARS`.
- If `selectedSkills[]` is empty (no skills selected for this run), no `<selected_skill>` block is emitted. The bundle continues with whatever `<selected_instruction>` blocks Phase 1 produces.
