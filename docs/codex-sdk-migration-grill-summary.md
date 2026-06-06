# Codex SDK Migration Grill Summary

## Context

This document replaces the previous Mastra migration grill summary. The current direction is no longer Mastra. The selected direction is a big-bang rewrite that uses the Codex SDK as the main coding agent for creating and updating generated retail websites.

The current custom AI Agent runtime is considered too inefficient and too expensive to maintain. The rewrite should remove the custom agent runtime internals while preserving or moving the product infrastructure that is still required for project lifecycle, preview, validation, and safety.

## High-Level Decision

Use Codex SDK as the coding engine for each project run.

The app still owns:

- project lifecycle
- project context summary
- draft workspace creation
- validation and preview health
- promotion to published workspace
- run state
- UI event mapping
- protected path policy
- boundary enforcement

Codex SDK owns:

- code generation inside the assigned draft workspace
- code update inside the assigned draft workspace
- repair attempts in the same Codex thread when validation fails

## Big-Bang Scope

The migration is a product-level big bang:

- User-facing generation/update flow moves to Codex SDK.
- API and UI are rewritten around `builder-runs`.
- Old run data is dropped.
- Old project state is reset.
- Existing project files on disk are kept, but compatibility is not guaranteed.

Implementation should still avoid deleting useful product infrastructure blindly. The selected removal scope is:

- Delete/replace AI runtime internals.
- Keep or move product infrastructure that is still needed.
- Move neutral infrastructure out of `src/features/ai-agent`.

## Target Module Layout

New Codex module:

```txt
src/features/agents/codex
```

Neutral product infrastructure paths:

```txt
src/features/projects/*
src/features/runtime/*
src/features/generated-projects/*
src/features/agents/codex/*
```

Shared UI/event types:

```txt
src/features/agents/ui
```

Instruction files:

```txt
templates/codex-builder/*
```

Phase 1 defers the generic skill runtime. Foundation instructions are loaded from `templates/codex-builder/*`. The retail templates currently scattered under `templates/{agent-system,init-prompt,init-recovery,redesign}/*` are migrated wholesale (single developer, pre-production) into:

```txt
templates/codex-builder/
  foundation/{retail-constraints,reasoning-workflow,edit-system}.md
  init/
    system.md
    init-mode.md
    manifest.json
    data/{catalog-data,data,packages,provider,component}.md
    pages/{home,products,product-detail,cart,checkout,orders,order-detail}.md
  recovery/{recovery,server-design-guidance,vertical-guidance}.md
  redesign/{anti-slop-repair,redesign-rewrite,token-patch-rewrite}.md
```

Migration uses `git mv` to keep history. The Codex context builder reads instructions only from `templates/codex-builder/*`; old paths are removed together with the AI Agent runtime.

## Codex SDK Runtime Choice

Codex SDK runs in-process in the backend/agent worker.

The selected option is:

- Use `@openai/codex-sdk`.
- Run inside the backend process or an app worker process.
- Do not use a separate app-server subprocess in phase 1.

Boundary requirement:

Codex must only read and write the draft workspace for the current project/user.

## Codex Config Management

Use generated Codex config.

Flow:

```txt
.env
  -> app loads env
  -> app validates required Codex env
  -> app writes app-owned CODEX_HOME/profile config
  -> Codex SDK runs with that profile
```

Decisions:

- One global app-owned `CODEX_HOME` for phase 1.
- Config lives in an app-owned data/cache directory, not inside generated project workspaces.
- API key comes from env through custom provider `env_key`.
- Generated Codex config contains `env_key`, not the secret value.
- If config is missing/invalid at startup, disable the Codex Agent feature but keep the rest of the app running.
- Do not silently fallback to another provider/model.

User-facing unavailable message:

```txt
AI builder is temporarily unavailable. Please contact an administrator or try again later.
```

Vietnamese equivalent:

```txt
Trinh tao AI hien tam thoi khong kha dung. Vui long lien he quan tri vien hoac thu lai sau.
```

## Project Context Model

Use a hybrid context model:

- Each prompt/run creates a new Codex thread.
- The app injects a compact project context bundle.
- The app maintains the authoritative project summary.
- Codex may compact internally during a thread/run.
- User can trigger project compaction.
- Project compaction creates a new summary version.
- Future runs use the latest approved summary.
- Routine summaries can auto-approve.
- Identity/commerce-impacting summaries require approval.

Phase 1 context bundle:

- latest approved project summary
- compact file manifest/tree
- current user prompt
- selected foundation instructions
- validation/promote rules
- draft workspace path
- locale rule

No full token packing or hard token budget in phase 1. Log token usage if Codex SDK exposes it.

## Draft Workspace And Promotion

Codex SDK must write only to a draft workspace.

Flow:

```txt
create draft workspace
  -> run Codex SDK
  -> audit draft
  -> validate
  -> repair if needed
  -> promote if gates pass
  -> publish/update preview
```

Draft retention:

- Cancelled draft: keep up to 12h.
- Failed validation draft: keep up to 12h.
- Boundary violation draft: keep up to 12h, restricted/internal only.
- Successful promoted draft: sync/copy into published workspace, then delete full draft copy.
- Keep diff/metadata artifact according to project history retention.
- User/admin deletion request deletes retained draft immediately.

Do not store raw prompt, raw diff, or full file content in logs.

## Boundary Enforcement

Use multi-layer enforcement. Prompt-only or app-path-only isolation is insufficient.

Each Codex run must enforce:

- Prompt instruction: work only inside the assigned project/draft.
- `cwd` is the draft workspace for the current project.
- Sandbox is `workspace-write`.
- No extra roots / no `add-dir` to other projects.
- App path guard verifies `projectId`, `userId`, and `draftWorkspacePath`.
- Symlink escape check before run.
- Filesystem audit before run, after run, and before promote.
- Post-run diff gate accepts only files inside the draft.
- Promotion gate only promotes the draft for the matching project/user.
- Logs/events must not leak absolute paths or content from other projects.

Boundary violation handling:

- Fail run immediately.
- Do not retry.
- Do not repair.
- Do not promote.
- Mark internal reason as `BOUNDARY_VIOLATION`.
- User-facing message is product-safe.

Repeated boundary violations:

- Project-level suspension after repeated violations.
- Escalate to user/org if repeated across projects.
- Active violations always fail closed.

Detection signals:

- Codex events/tool errors
- sandbox denial/error patterns
- app-side filesystem audit
- diff gate
- promotion gate

## Protected Path Policy

Use a mixed protected path policy.

Blocked paths:

```txt
package.json
pnpm-lock.yaml
package-lock.json
yarn.lock
bun.lockb
.env
.env.*
src/routes/__root.tsx
src/main.*
src/router.*
vite.config.*
tsconfig.json
tailwind.config.*
postcss.config.cjs
public/sw.js
```

Allowed with audit:

```txt
src/routes/**
src/components/**
src/styles/**
src/lib/**
src/hooks/**
src/shared/sample-data/**
public/assets/**
```

If a user request requires blocked paths:

- Do not call Codex SDK.
- Do not create a draft mutation.
- Return a friendly warning.
- Suggest changing UI/content/sections/products/layout inside supported scope.
- Log blocked intent/path internally.

Future runtime/config changes should use a separate special flow such as `runtime_migration` or `template_upgrade`, with admin/dev approval and stronger validation.

## Changed File Limits

Normal update:

- max 20 changed files

Init new website:

- max 40 changed files per batch

If init needs more than 40 files, use a paged/batched generation loop.

## Init Batching

Use hybrid batching for init:

1. Foundation/data batch
2. Page/route batches
3. Final polish batch
4. Final validation and promote

Use one Codex thread for the whole init run, with multiple turns by batch.

Batch planning:

- App creates a skeleton batch plan.
- Codex may refine the plan.
- Codex may not introduce blocked paths.
- If the plan includes blocked paths, ask Codex to revise once.
- If revised plan still needs blocked paths, fail before mutation.

Init requires a planning turn before mutation.

Small updates can run directly.

## Update Classification

Small/direct update includes:

- content/copy/product sample changes
- UI style/layout changes within existing pages/components
- adding a new section/component within an existing route

Small/direct update excludes:

- dependency/package changes
- router/root/runtime changes
- new major app flow
- config/build changes

Adding a new route/page requires a planning turn first.

## Validation And Repair

Phase 1 validation:

- `pnpm run typecheck`
- `pnpm run build` for init and new route/page updates
- preview health
- PM2 instance/status check
- core route checks

Small/direct updates may skip build and still promote if typecheck and preview health pass.

Repair:

- Same Codex thread handles repair.
- Send validation summary back to Codex.
- Maximum 2 repair cycles.
- If still failing, mark run failed and do not promote.

Failure taxonomy phase 1:

- `validation_failed`
- `boundary_violation`
- `config_unavailable`
- `cancelled`
- `preview_failed`
- `codex_runtime_failed`
- `blocked_request`
- `repair_exhausted`

## Preview Health

Preview health phase 1:

- start/restart preview runtime if needed
- verify PM2 instance exists and has expected status
- root URL returns 200
- key route URLs return 200
- include any new route/page from current run
- derive routes from project manifest/file tree where possible

Core routes hard gate:

```txt
/
/products
/products/:sampleProductId
/cart
/checkout
```

Optional route failure:

- Promote is allowed.
- Mark optional route failure in preview health metadata.
- User-facing summary may include a soft warning.
- Internal log records failed optional routes.

Product detail sample id is derived from product sample data, not from Codex text output.

## Product Sample Data Contract

Product sample data is both sample data and a representation of real API product list response shape.

Fixed path:

```txt
src/shared/sample-data/products.ts
```

Fixed export:

```ts
export const productsListSample = { ... };
```

Rules:

- Keep raw API product list response shape.
- Do not simplify or normalize the raw sample shape.
- Codex may update product sample data only if it preserves the shape and passes audit.
- If normalized view models are needed, create a helper/adapter separately.

Minimum expected top-level shape:

```ts
{
  total: number,
  data: Product[]
}
```

The app derives product detail sample id in this order:

1. `productsListSample.data[0].id`
2. `productsListSample.data[0].entityId`
3. `productsListSample.data[0].defaultModel.productId`

If project detail `.env` does not have `VITE_STORE_SLUG`:

- Do not write `.env`.
- Runtime falls back using sample data.
- Prefer `productsListSample.data[0].store.slug`.
- If missing, fallback to product id for sample route/data behavior.

Parser:

- Use AST/static evaluator.
- Do not dynamically execute generated TypeScript data file.
- Export must be JSON-compatible.
- No function calls.
- No runtime imports.
- No complex computed expressions.

Phase 1 product check:

- Parser smoke check can extract product id and store slug/fallback.
- No full Zod/commerce validation in phase 1.
- Do not claim commerce validated.

Images:

- Use seeded Picsum URLs for product sample images.
- Allowlist `https://picsum.photos/seed/` in phase 1.
- Seed should be stable, not random per run.

Example:

```txt
https://picsum.photos/seed/<stable-seed>/<width>/<height>
```

## Commerce Validation

Commerce contract tests are deferred in phase 1.

Phase 1 can promote if:

- diff/path gate passes
- typecheck passes
- build passes when required
- preview/PM2/core routes pass
- product sample parser smoke check passes

Run metadata should mark:

```txt
commerceValidationStatus: skipped
```

User-facing summary must not claim cart/checkout/commerce correctness has been fully validated.

## Events And UI

API/UI are rewritten around builder runs.

API concept:

```txt
builder-runs
```

Example routes:

```txt
/api/projects/:projectId/builder-runs
/api/projects/:projectId/builder-runs/:runId/stream
/api/projects/:projectId/builder-runs/:runId/cancel
/api/projects/:projectId/builder-runs/:runId/retry
```

Event mapping:

- Map Codex SDK events into product-safe builder milestones.
- Do not stream raw Codex events to user UI.
- Store internal technical metadata without raw prompt/diff/full file content.

Product-safe milestones:

- loading context
- planning
- creating draft
- building pages
- checking preview
- repairing
- publishing
- done
- failed
- cancelled

Internal audit metadata stores:

- status
- duration
- changed file paths
- validation result
- error code
- selected instructions/skills if applicable
- config/model/provider
- context summary version

No raw prompt.
No raw diff.
No full file content.

## Cancellation

If user cancels generation:

- Interrupt active Codex turn.
- Mark run as `cancelled`.
- Do not promote draft.
- Keep draft up to 12h for debug/audit.
- User-facing message: generation was cancelled and no changes were published.

## Concurrency

Phase 1 rule:

- 1 builder run per project at a time.

If a project already has an active run:

- reject new prompt with a friendly message
- do not queue phase 1
- user may wait or cancel current run

## Data Reset

DB run state:

- Create new `builder_runs` table.
- Drop/ignore old `agent_runs`.
- Do not migrate historical agent run data.

Project state:

- Old project state is reset.
- Existing old project files remain on disk, but app does not guarantee compatibility.
- New builder flow starts from the new schema.

Spec must include a clear "no backward compatibility" section.

## Phase 1 Success Criteria

Phase 1 is successful when:

1. Init new website works through Codex SDK.
2. Small update works.
3. New route/page update works with planning turn.
4. Cancel path works.
5. Validation fail triggers same-thread repair up to 2 cycles.
6. Promotion only happens after gates pass.
7. Boundary violation fails closed.
8. Draft retention/cleanup rules work.
9. UI/API are rewritten to builder-runs.
10. Old project state/run data is reset.
11. Protected path policy is enforced.
12. Product sample parser smoke check works.
13. Preview/PM2/core route health works.

## Codex SDK Flow Alignment With Skill Runtime

Although the generic skill runtime is deferred from phase 1, the Codex SDK builder flow must be designed so it can adopt the skill runtime without changing the core lifecycle.

The Codex SDK lifecycle should keep the same slots that the skill-runtime grill defined:

```txt
load project context
  -> detect/select instruction sources
  -> resolve clarification before mutation
  -> build Codex context bundle
  -> run Codex SDK in draft workspace
  -> validate/repair/promote
```

Phase 1 uses hardcoded foundation instructions from:

```txt
templates/codex-builder/*
```

Later phases replace or extend those foundation instructions with selected skills from:

```txt
$SKILLS_ROOT/<skill-name>/SKILL.md
```

The context bundle should therefore reserve a stable section for selected instructions:

```txt
<builder_context>
  project summary
  user prompt
  locale
  file manifest
  draft workspace
  protected path policy
  validation/promote rules
</builder_context>

<selected_instructions>
  phase 1: rendered templates/codex-builder/*
  later: required foundation skills + selected optional skills
</selected_instructions>
```

### Responsibility Mapping

The earlier skill-runtime design used "thinking layer" and "agentic loop" terminology. In the Codex SDK rewrite, those map to:

| Skill-runtime term | Codex SDK rewrite equivalent |
| --- | --- |
| Thinking layer | App-side planner/context builder before Codex mutation |
| Agentic loop | Codex SDK thread/turn running inside draft workspace |
| selected skill metadata | selected instruction metadata in builder run state |
| full selected `SKILL.md` developer message | rendered selected instructions block in Codex context bundle |
| clarification before mutation | builder-run planning/clarification step before Codex SDK writes |
| tool mutation gates | app-side draft audit, diff gate, validation gate, promotion gate |

This means Codex SDK should not decide hard product contracts by itself. The app still decides:

- required foundation instructions
- protected paths
- whether clarification is needed before mutation
- whether draft output passes validation
- whether draft is promoted

Codex SDK only executes the coding turn inside the permitted draft workspace.

### Clarification Compatibility

Phase 1 may not implement generic skill clarification, but the run state should be compatible with it.

Builder run metadata should be able to store:

```ts
pendingInstructions?: Array<{
  name: string;
  source: "template_required" | "template_recommended" | "explicit_user" | "detected";
  reason?: string;
}>;
```

When generic skills are added later, this becomes:

```ts
pendingSkills?: Array<{
  name: string;
  source: "template_required" | "template_recommended" | "explicit_user" | "detected";
  score: number;
  hash?: string;
}>;
```

Clarification must happen before Codex SDK mutates draft files. A run that is waiting for clarification must not create or mutate a draft workspace.

### Skill Injection Compatibility

Phase 1 rendered instructions should use the same conceptual wrapper that selected skills will use later.

Phase 1:

```md
<selected_instruction name="retail-builder-foundation" source="template_required">
--- instruction ---
...
</selected_instruction>
```

Future generic skill runtime:

```md
<selected_skill name="design-taste-frontend" version="1.0.0" hash="...">
Enforcement: required_context
Applies to: init_project, ui_mutation

--- SKILL.md ---
...
</selected_skill>
```

This keeps Codex prompts stable and makes it easier to swap hardcoded foundation templates for skill-selected content later.

### Tool Compatibility

The earlier design proposed a generic tool:

```ts
project_read_skill({ name: string })
```

In the Codex SDK rewrite, phase 1 does not need Codex to call this as a mutation-time tool. The app-side context builder can load and inject required instructions before Codex starts.

Later, if a Codex MCP/tool layer is added, `project_read_skill` can be exposed as a read-only tool. It must not grant additional filesystem access or allow Codex to bypass the app's selected-skill resolver.

Required skills should still fail fast before mutation if unavailable.

### Metadata Compatibility

Phase 1 builder runs should store instruction metadata without raw instruction content:

```ts
selectedInstructions: [
  {
    name,
    source,
    version,
    hash,
    loaded: true
  }
]
```

When generic skill runtime is implemented, this becomes or extends:

```ts
selectedSkills: [
  {
    name,
    source,
    score,
    hash,
    loaded: true
  }
]
```

Do not store full skill or instruction content in DB logs.

## Deferred Generic Skill Runtime

The generic skill runtime is deferred from phase 1 but preserved as an agreed design for a later phase.

### Required Skill Failure

Suggested user-facing required failure:

```txt
Cannot continue because a required agent instruction is unavailable.
```

Suggested internal event/log:

```txt
required_skill_unavailable
```

### Thinking vs Agentic Loop

Split responsibilities:

- Thinking layer receives skill metadata only, not full content.
- Agentic loop receives full selected `SKILL.md` content as developer messages.
- Thinking layer decides ambiguity and clarification based on metadata, prompt, and project state.
- Agentic loop mutates only after clarification has been resolved.

If a skill has `asksClarification: true` and `clarificationPolicy: when_ambiguous`, the thinking layer may return `needs_clarification` with exactly one question and a recommended answer/options.

### Clarification Resume

When asking clarification:

- Store `pendingSkills` in run metadata.
- On user answer, rerun detector with:
  - original prompt
  - clarification answer
  - pending skill metadata
- Pending required or explicit skills carry a high score.
- Do not detect from answer-only.

### Tools

The generic `project_read_skill` tool is part of the deferred phase-2 skill runtime, not phase 1.

When phase 2 lands, only the generic tool is added:

```ts
project_read_skill({ name: string })
```

Behavior:

- Loads `$SKILLS_ROOT/<name>/SKILL.md`
- Marks context with `loadedSkills: string[]`

There is no `tasteSkillLoaded` flag and no `project_read_taste_skill` alias. The legacy taste-skill loader/preload pipeline is deleted with the rest of the AI Agent runtime; nothing is preserved as a backward-compatibility wrapper.

### Replace Current Taste Skill Hardcoding

Legacy AI Agent behavior (to be deleted with the runtime, not aliased):

- `taste-skill-loader.server.ts` hardcoded `.agents/skills/design-taste-frontend/SKILL.md`
- `taste-skill-preload.server.ts` preloaded ~28k chars
- pre-write hook checked `flags.tasteSkillLoaded`
- init set `tasteSkillLoaded: true`

The Codex SDK rewrite removes all of these. Phase 2 introduces the generic skill runtime fresh, with `design-taste-frontend` as the first skill at:

```txt
$SKILLS_ROOT/design-taste-frontend/SKILL.md
```

No flag, no alias, no taste-specific code path.

### Run Metadata And Logs

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

### Implementation Success Criteria

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
