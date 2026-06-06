# Minimal Generic Skill Runtime Discussion Summary

This summary captures the agreed design for adding a minimal generic skill runtime to the AI Agent in this repo.

## Goal

Build a generic skill runtime for the AI Agent instead of hardcoding `tasteSkillLoaded` or `project_read_taste_skill`.

The agent flow should be:

1. Detect relevant skills from the user prompt and active template instructions.
2. Load the correct `SKILL.md` from a dedicated skills root.
3. Inject selected skill content using a stable format.
4. If a skill requires clarification, allow the thinking/orchestrator layer to stop and ask the user exactly one question.
5. After the user answers, resume and only then mutate code.

## Skills Root

Create a dedicated skills folder similar to `PROJECTS_ROOT`.

- Env: `SKILLS_ROOT`
- Dev default: `process.cwd()/skills`
- Production default: `/var/bin/skills`
- Skill path: `$SKILLS_ROOT/<skill-name>/SKILL.md`

Do not fallback to `.agents/skills`. The legacy taste-skill loader is deleted with the AI Agent runtime; the new design migrates directly to `SKILLS_ROOT`.

Example:

```txt
cloud-ai/
  skills/
    design-taste-frontend/
      SKILL.md
    grill-me/
      SKILL.md
```

## Skill Metadata

Each `SKILL.md` should use minimal frontmatter:

```yaml
name: design-taste-frontend
description: Anti-slop frontend skill...
aliases:
  - taste skill
  - anti-slop
triggers:
  - redesign
  - premium UI
  - storefront UI
asksClarification: true
clarificationPolicy: when_ambiguous
appliesTo:
  - init_project
  - design_update
  - ui_mutation
```

Supported `clarificationPolicy` values:

- `never`
- `when_ambiguous`
- `always_before_apply`

## Template Declarations

Template `.md` files should support both frontmatter YAML and inline directives.

Frontmatter example:

```yaml
requiredSkills:
  - design-taste-frontend
recommendedSkills:
  - storefront-design-authoring
```

Inline examples:

```md
@skill:design-taste-frontend required
@skill:storefront-design-authoring recommended
```

Only collect skill declarations from active prompt templates, not from all `templates/**/*.md`.

In the Codex SDK rewrite, retail templates are consolidated under `templates/codex-builder/*`. Initial templates that should expose `requiredSkills` / `recommendedSkills` declarations:

- `templates/codex-builder/foundation/edit-system.md`
- `templates/codex-builder/init/system.md`
- `templates/codex-builder/recovery/*.md`
- `templates/codex-builder/redesign/*.md`

## Detection

Detection sources:

- Template `requiredSkills` and `recommendedSkills`
- Explicit user mention by skill `name` or `aliases`
- Prompt trigger phrase match
- Description keyword cluster
- Project/task context via `appliesTo`

Deterministic scoring:

- `+100`: template `requiredSkills`
- `+80`: user explicit mention skill name or alias
- `+60`: template `recommendedSkills`
- `+25`: exact trigger phrase in prompt
- `+15`: description keyword cluster
- `+10`: project/task context matches `appliesTo`

Thresholds:

- `>= 80`: include automatically
- `50-79`: candidate; include if no conflict and within limit
- `30-49`: metadata only for thinking, no full injection
- `<30`: ignore

Conflict rule:

If two candidates conflict in the same category or aesthetic and both score `50-79`, the thinking layer asks exactly one clarification question.

## Selection Limit

Default `maxSelectedSkills = 3`.

Priority order:

1. Required skills, never dropped.
2. Explicit user-requested skills.
3. Recommended or detected skills sorted by score.

If required skills exceed the limit, include all required and emit a warning.

Full content can be truncated by `MAX_SKILL_CHARS`, but selected skill metadata should store a hash for audit.

## Required vs Recommended Behavior

- Required missing or invalid: fail fast. Do not continue silently.
- Recommended missing or invalid: log warning and continue.
- User explicitly asks for a missing skill: return a clear unavailable message.

Suggested user-facing required failure:

```txt
Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent.
```

Suggested internal event/log:

```txt
required_skill_unavailable
```

## Thinking vs Agentic Loop

Split responsibilities:

- Thinking layer receives skill metadata only, not full content.
- Agentic loop receives full selected `SKILL.md` content as developer messages.
- Thinking layer decides ambiguity and clarification based on metadata, prompt, and project state.
- Agentic loop mutates only after clarification has been resolved.

If a skill has `asksClarification: true` and `clarificationPolicy: when_ambiguous`, the thinking layer may return `needs_clarification` with exactly one question and a recommended answer/options.

## Clarification Resume

When asking clarification:

- Store `pendingSkills` in run metadata.
- On user answer, rerun detector with:
  - original prompt
  - clarification answer
  - pending skill metadata
- Pending required or explicit skills carry a high score.
- Do not detect from answer-only.

## Tools

Add generic tool:

```ts
project_read_skill({ name: string })
```

Behavior:

- Loads `$SKILLS_ROOT/<name>/SKILL.md`
- Marks context with `loadedSkills: string[]`

There is no `tasteSkillLoaded` flag and no `project_read_taste_skill` alias. The legacy taste-skill loader/preload pipeline is removed with the AI Agent runtime, not preserved as a backward-compat wrapper.

## Replace Current Taste Skill Hardcoding

Legacy AI Agent behavior (deleted by the Codex SDK migration, not aliased):

- `taste-skill-loader.server.ts` hardcoded `.agents/skills/design-taste-frontend/SKILL.md`
- `taste-skill-preload.server.ts` preloaded ~28k chars
- pre-write hook checked `flags.tasteSkillLoaded`
- init set `tasteSkillLoaded: true`

The skill runtime introduces `design-taste-frontend` fresh as the first entry under:

```txt
$SKILLS_ROOT/design-taste-frontend/SKILL.md
```

No flag, no taste-specific code path.

## Run Metadata and Logs

Store selected skill metadata, not full content:

```ts
selectedSkills: [
  {
    name,
    source: "template_required" | "template_recommended" | "explicit_user" | "detected",
    score,
    hash,
    loaded: true
  }
]
```

Suggested events/logs:

- `skill_registry_loaded`
- `skill_selected`
- `skill_load_failed`
- `skill_injected`

## Implementation Success Criteria

1. `SKILLS_ROOT` config exists with dev default `process.cwd()/skills` and production default `/var/bin/skills`.
2. Skill loader/registry reads `$SKILLS_ROOT/<skill>/SKILL.md`.
3. Frontmatter parser supports the agreed metadata fields.
4. Active prompt templates under `templates/codex-builder/*` expose required/recommended skill declarations.
5. Deterministic detector selects skills by score.
6. Thinking layer (app-side context builder) receives selected/candidate metadata only.
7. Agentic loop (Codex thread/turn) injects full selected skill content via the `<selected_skill>` wrapper.
8. Generic `project_read_skill` exists.
9. `design-taste-frontend` is provisioned as the first skill in `$SKILLS_ROOT/design-taste-frontend/SKILL.md`.
10. Required missing skill fails fast.
11. Selected skill metadata is logged/stored without full content.
12. Focused tests or validation cover loader, detector, and template declaration parsing.
