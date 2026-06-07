# Implementation Plan: Codex SDK Chat Migration

**Branch**: `027-codex-sdk-chat-migration` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/027-codex-sdk-chat-migration/spec.md`

## Summary

Replace the legacy ai-agent chat path with the Codex SDK builder-runs path so the project-detail chat no longer triggers the patch-applier bug. The migration runs in five sequential phases, with chat continuously functional after each phase. Phase 1 already kills the bug by routing chat traffic through the Codex SDK builder runners while keeping the existing chat UI. Phases 2–4 reshape the frontend onto the new API and reintroduce reasoning effort, plan mode (two-phase), retail-vibe design variants, and clarification rendering by question type. Phase 5 deletes the legacy code paths in one pass.

## Technical Context

**Language/Version**: TypeScript 5.x with React 19, TanStack Router/Query/Start
**Primary Dependencies**: `@openai/codex-sdk` (^0.137.0), Drizzle ORM 0.45.2, PostgreSQL (`pg`), TanStack Query 5, Tailwind CSS, shadcn/ui (radix)
**Storage**: PostgreSQL via Drizzle (`json` columns per Constitution IX); local filesystem for project draft and published workspaces under `var/bin/projects/<projectId>/{drafts,published}`; in-memory `BuilderRunHandle` registry, replaced/augmented with persisted run state in `agent_runs`.
**Testing**: Vitest (`pnpm vitest`), TypeScript `noEmit` typecheck (`pnpm typecheck`), runtime smoke checks via `pm2`-managed project preview
**Target Platform**: Self-hosted Node.js 22+ runtime (Vite + tsx) on Linux/Darwin; browser clients on modern evergreen browsers; non-technical retailers as primary audience, Vietnamese-locale-first
**Project Type**: Single-repo web application — TanStack Router routes serve both UI and `/api/...` server endpoints; no separate backend/frontend split
**Performance Goals**: First progress-message after submit ≤ legacy median, p95 ≤ 1.25× legacy p95 (SC-004); SSE event lag ≤ 200 ms within local network; init flow under five minutes wall-clock for variant pick (SC-007)
**Constraints**: Zero leakage of file paths, code identifiers, or framework names in user-visible text (FR-007, SC-002); no destructive schema migration to `messages` table (Assumptions); plan mode never mutates workspace (FR-013, SC-006); chat must stay functional at every phase boundary (FR-028)
**Scale/Scope**: ~50 active retailer projects in dev, scaling to ~10k storefront projects post-launch; ≤ 200 chat turns per project lifetime; one in-flight builder run per project at a time (existing `ActiveRunExistsError` invariant)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|-----------|------------|
| I. Yêu cầu rõ ràng code flow & tính năng | PASS — five phases each have a precise scope and boundary; chat flow (UI → `/api/.../builder-runs` → `BoundedCodexThread` → workspace) is documented end-to-end. |
| II. Test cho mọi business rule quan trọng | PASS — every FR maps to acceptance scenarios in `spec.md`; this plan defers detailed test plan to `tasks.md` and `quickstart.md` but mandates Vitest coverage for classifier, progress filter, plan-mode gate, runStore persistence, and clarification metadata routing. |
| III. API trả lỗi nhất quán | PASS — server endpoints continue to return JSON `{ ok: false, code, message }` per existing builder-runs contract (`/api/projects/$projectId/builder-runs/index.ts`); the new chat endpoints reuse the same shape. |
| IV. Không over-engineer | PASS — plan reuses the existing `BoundedCodexThread`, `runStore`/`agent_runs`, `messageRepository`, and SSE infrastructure; no new framework or service is introduced; legacy ai-agent code is deleted in Phase 5 to remove dead paths. |
| V. UX đơn giản, validation client/server, DESIGN.md compliance | PASS — composer keeps existing styles; design-variant cards reuse current shadcn/Tailwind components; no hard-coded colors are introduced; user input is validated both at the composer (non-empty prompt, plan-mode toggle) and in `/api/.../runs` and `/builder-runs` server handlers. |
| VI. Bảo mật theo role/permission | PASS — every API handler calls `requireServerUser()`; ownership is checked against `project.userId` and `BuilderRunHandle.userId`; no `.env`/secret writes are introduced (the only env touched remains the existing `VITE_STORE_SLUG` exception). |
| VII. Code Review & Impact Analysis ưu tiên Graph | PASS — Phase 5 cleanup is preceded by a code-graph review across `features/ai-agent/**` to confirm no live caller remains before deletion. |
| VIII. Chuẩn hóa Code Formatting | PASS — every commit runs `pnpm lint` + `pnpm typecheck` per existing repository hooks; this plan adds no new tooling. |
| IX. Database JSON Type Convention | PASS — any new column or expansion (e.g., `agent_runs.progress_timeline`, `agent_runs.plan_phase`, `messages.metadata`) MUST use Drizzle `json()`, never `jsonb()`. |
| X. Import Alias Convention | PASS — all new modules MUST import via `@/...` aliases; no `../` cross-folder imports. |

No violations. No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/027-codex-sdk-chat-migration/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 — research findings
├── data-model.md        # Phase 1 — data model
├── quickstart.md        # Phase 1 — verification + dev workflow
├── contracts/           # Phase 1 — interface contracts
│   ├── chat-api.md      # HTTP endpoints + SSE event contract
│   ├── builder-runs.md  # Codex builder-run-driver inputs/outputs
│   └── progress-events.md # Progress event vocabulary + privacy filter
├── checklists/
│   └── requirements.md  # Existing spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── routes/
│   ├── projects/$projectId.tsx                                  # chat composer + chat panel; switches data source from /runs to /builder-runs (Phase 2)
│   └── api/projects/$projectId/
│       ├── runs/                                                 # legacy chat endpoints — kept transparent in Phase 1, removed in Phase 5
│       └── builder-runs/                                         # new chat endpoints (already exist for codex SDK)
├── features/
│   ├── agents/
│   │   ├── codex/
│   │   │   ├── runtime/
│   │   │   │   ├── builder-run.server.ts                         # init / new-route / small-update drivers — extended for plan mode + retail variants
│   │   │   │   ├── builder-run-registry.server.ts                # in-memory handle store — extended to persist via runStore
│   │   │   │   ├── codex-thread.server.ts                        # BoundedCodexThread — wires modelReasoningEffort + sandbox toggle
│   │   │   │   ├── plan-mode.server.ts                           # NEW (Phase 3): plan turn driver + approve/reject coordinator
│   │   │   │   ├── design-variants.server.ts                     # NEW (Phase 4): retail-vibe variant generator wrapper
│   │   │   │   └── update-classifier.server.ts                   # existing: extended to accept project-state hint for kind=init
│   │   │   └── skills/                                           # existing skill registry; design-taste-frontend+retail prompt augmentations
│   │   └── ui/
│   │       ├── use-builder-run-stream.ts                         # existing SSE hook — extended with chat-message reducer (Phase 2)
│   │       ├── BuilderRunProgress.tsx                            # existing progress UI — replaced/extended for chat panel
│   │       ├── ChatComposer.tsx                                  # NEW or rewired (Phase 2): composer with reasoning effort + plan toggle
│   │       ├── DesignVariantPicker.tsx                           # NEW (Phase 4): visual-lite variant cards
│   │       ├── SkillClarificationList.tsx                        # NEW (Phase 4): simple list clarification
│   │       └── PlanReview.tsx                                    # NEW (Phase 3): plan markdown + Approve/Reject
│   └── ai-agent/                                                 # LEGACY — deleted entirely in Phase 5
├── server/
│   ├── repositories/
│   │   └── agent-run-repository.ts                               # extended in Phase 0 for restart-safe state (progress timeline, plan phase, clarification snapshot, reasoning effort)
│   ├── services/
│   │   ├── message-service.ts                                    # Phase 1: runOrchestrator delegates to builder-run drivers; Phase 2: superseded by builder-runs API; Phase 5: removed
│   │   └── project-services.ts                                   # service registry — adjusted in Phase 5
│   └── functions/
│       └── progress-mapper.server.ts                             # NEW (Phase 0): file-path → user-visible page/section mapper + privacy filter
├── shared/
│   └── project-types.ts                                          # types — extended (additive) for plan-mode + design-variant metadata
└── db/
    └── schema.ts                                                 # Drizzle schema — additive `json()` columns on agent_runs (Phase 0)

tests/
├── contract/                                                     # API + SSE contract tests
├── integration/                                                  # end-to-end chat scenarios per US1..US6
└── unit/                                                         # progress mapper, classifier, plan-mode gate, runStore round-trip
```

**Structure Decision**: Single project (web application without separated backend/frontend). All chat work lives under `src/features/agents/codex/**` (runtime + UI), `src/server/{repositories,services}`, and the existing `/api/projects/$projectId/builder-runs/**` route tree. Legacy code remains untouched until Phase 5, then is deleted in one PR.

## Complexity Tracking

> No constitution violations. Section intentionally left empty.
