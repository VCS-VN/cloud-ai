# Implementation Plan: Init Settings Seed

**Branch**: `[main]` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/030-init-settings-seed/spec.md`

## Summary

Prepare generated storefront workspaces before Codex SDK Agent execution by seeding runtime-owned settings, editable baseline styling/root files, and dependency artifacts. Runtime setup occurs before file manifest collection, context building, baseline snapshot, and Agent turns. Protected settings remain runtime-owned; Agent customization is routed to editable global CSS and root route files.

## Technical Context

**Language/Version**: TypeScript 6.x, React 19.x, Node-compatible server runtime  
**Primary Dependencies**: Codex SDK runtime, TanStack Start/Router, Vite, Tailwind CSS, pnpm  
**Storage**: Filesystem templates and generated project workspaces  
**Testing**: No new automated tests requested; manual validation plus existing typecheck/build/preview gates  
**Target Platform**: macOS/Linux development and generated storefront preview environment
**Project Type**: Web application builder with generated storefront workspaces  
**Performance Goals**: Avoid repeated dependency install when dependency directory and lockfile already exist; keep seeding before Agent work lightweight and deterministic  
**Constraints**: Do not add settings to Agent manifest/batches; do not change protected-path rules; do not seed obsolete client/server/main entrypoints; fail before Agent execution on setup conflicts  
**Scale/Scope**: One init flow in Codex SDK builder runtime; eight seeded target files; dependency setup per generated project workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Clear code flow & feature behavior**: PASS — spec separates runtime setup, dependency baseline, Agent generation, validation, and protected-path enforcement.
- **II. Tests for important business rules**: ACKNOWLEDGED EXCEPTION — user explicitly requested no new tests. Existing validation gates and manual quickstart cover acceptance for this feature.
- **III. API error consistency**: PASS — no public API shape changes planned; builder failure codes reuse existing run failure outcomes.
- **IV. No over-engineering**: PASS — focused module and static templates, no manifest changes, no broad scaffold refactor.
- **V. UX/design compliance**: PASS — generated storefront styling remains token-driven through editable global CSS; Builder UI strings are not in scope.
- **VI. Role/permission/security**: PASS — no secrets or env files touched; protected files remain Agent-blocked.
- **VII. Review/impact analysis**: PASS — affected code is limited to Codex init runtime and templates.
- **VIII. Formatting**: PASS — implementation must match existing TypeScript/Markdown style and run project checks if coding begins.
- **IX. Database JSON convention**: N/A — no database schema changes.
- **X. Import alias convention**: PASS — seeded storefront config provides alias support; new app imports should use `@/` outside same-folder imports.
- **XI. Builder UI locale**: PASS — no Builder UI copy added; generated storefront content is excluded by constitution.

## Project Structure

### Documentation (this feature)

```text
specs/030-init-settings-seed/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/features/agents/codex/runtime/
├── builder-run.server.ts
└── init-settings-seed.server.ts

templates/codex-builder/init/
├── init-mode.md
└── settings/
    ├── package.json.md
    ├── vite.config.ts.md
    ├── tsconfig.json.md
    ├── tailwind.config.ts.md
    ├── postcss.config.cjs.md
    ├── src-router.tsx.md
    ├── src-styles-app.css.md
    └── src-routes-root.tsx.md
```

**Structure Decision**: Add one focused runtime seed module near existing Codex init orchestration. Add one template directory under existing init templates. Update existing init orchestration and init prompt only; keep protected paths and init manifest unchanged.

## Complexity Tracking

No constitution violations requiring complexity justification beyond the accepted no-new-tests exception requested by user.

## Phase 0: Research Summary

See [research.md](./research.md).

Resolved decisions:
- Runtime seeds settings before Agent execution.
- One Markdown template per target file, with frontmatter target and raw body.
- Runtime-owned settings differ from editable baselines.
- Storefront baseline remains SEO-capable and minimal.
- Dependencies install after seed and before snapshot.
- Protected-path rules remain unchanged.

## Phase 1: Design Summary

See [data-model.md](./data-model.md) and [quickstart.md](./quickstart.md).

Design outputs:
- SeedTemplate, RuntimeOwnedSetting, EditableBaselineFile, DependencyBaseline, InitWorkspace entities.
- Manual validation quickstart for fresh init, conflict handling, and resume behavior.
- No external contracts required; this feature changes internal runtime setup and generated workspace files only.

## Phase 2: Implementation Approach

1. Create settings templates under `templates/codex-builder/init/settings/`.
2. Add `init-settings-seed.server.ts` with template parsing, safe target validation, seed policies, and dependency install/skip helper.
3. Wire seed + install into `runInitBuilderRun` immediately after workspace creation and before manifest/context/snapshot/thread setup.
4. Map conflicting runtime-owned files to blocked-request failure; map invalid templates/write/install failures to runtime setup failures.
5. Update `init-mode.md` to clarify runtime-owned settings, editable theme/root files, and forbidden entrypoint creation.
6. Run existing validation/manual quickstart checks as feasible.

## Post-Design Constitution Check

- **Simplicity**: PASS — no manifest/batch changes and no protected-path changes.
- **Surgical scope**: PASS — only Codex init runtime, templates, and init prompt touched.
- **Boundary safety**: PASS — runtime-owned files stay blocked from Agent after snapshot.
- **Validation**: PASS WITH ACKNOWLEDGED EXCEPTION — no new tests per user request; manual and existing validation gates documented.
