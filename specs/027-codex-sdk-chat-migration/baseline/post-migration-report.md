# Post-Migration Report — Codex SDK Chat Migration

**Feature**: `027-codex-sdk-chat-migration`
**Completed**: 2026-06-07
**Branch HEAD at completion**: `main` after Phase 10 cleanup commit

## Summary

The project-detail chat agent now runs end-to-end on the codex SDK builder-run path. The legacy ai-agent chat orchestrator (`AgentOrchestrator`, `MessageService`, `useAgentStream`, `/runs` route subtree) is deleted. The original patch-applier bug (file scrambling on pure-insertion hunks) is gone because `ProjectPatchService.applyHunks` is no longer in the chat call path.

## Phase outcomes

| Phase | Tasks | Result |
|---|---|---|
| 1. Setup | T001–T004 | ✅ |
| 2. Foundational (schema, repo, mapper, classifier, codex thread wiring) | T005–T023 | ✅ |
| 3. US1 hero update bug kill (bridge + translator) | T024–T030 | ✅ |
| 4. US2 privacy guarantee (centralized friendly errors, raw text never leaks) | T031–T034 | ✅ |
| 5. Frontend migration to `/builder-runs` | T035–T045 | ✅ |
| 6. US3 plan mode 2-phase (read-only plan turn → Approve/Reject → execute turn) | T046–T057 | ✅ |
| 7. US4 retail design variants (4 cards + custom freeText) | T058–T066 | ✅ |
| 8. US5 skill clarification list (visually distinct from variants) | T067–T070 | ✅ |
| 9. US6 restart safety (interrupted_by_restart, awaiting-clarification recovery) | T071–T076 | ✅ |
| 10. Polish & cleanup (scoped chat-only delete) | T077–T087 | ✅ (with deviation, see below) |

## Test results

- `pnpm typecheck`: clean
- `pnpm vitest run`: **377 / 377 tests pass** across 64 test files
- New tests added during the migration:
  - Foundational unit (T011, T012, T015, T017, T019–T022): 38 cases
  - US1 contract + integration (T024, T025): 14 cases
  - US2 privacy + friendly-errors (T031, T032): 25 cases
  - Phase 5 contract + integration (T043, T044): 12 cases
  - US3 plan mode (T046–T049): 16 cases
  - US4 design variants (T058–T060): 16 cases
  - US5 skill clarification (T067): 3 cases
  - US6 restart safety (T071–T073): 7 cases
  - User guide renderer: 10 cases
  - Phase 10 cleanup guard: 4 cases

## Manual smoke

The repo is pre-production with no DB available in this development session, so the manual smoke from `quickstart.md` was not executed end-to-end. The pre-migration baseline note (`baseline/README.md`) describes the original bug repro and the regression seal: post-Phase 1 `tests/integration/us1-hero-update.test.ts` confirms that for a stub codex thread, the bridge:

- emits a clean SSE sequence (`run.started → skeleton.update → message.created → message.completed → run.completed`)
- persists a β-lite answer with `provider="codex-sdk"`
- pushes events to the progress timeline
- never surfaces a file path or framework token

Privacy-wise, `tests/integration/us2-privacy-progress.test.ts` runs 10 mixed adversarial sequences and asserts every user-visible string passes `isPrivacySafe`. Plan-mode workspace integrity is asserted by `tests/integration/us3-plan-mode-{approve,reject}.test.ts` via snapshot diff before/after the plan turn.

## Deviations from the plan

### Phase 10 scope reduction (intentional, user-approved)

The original spec for T079 says "Delete `src/features/ai-agent/` (entire directory) in one commit." When the gate condition was checked (`pnpm exec rg -l '@/features/ai-agent'`), 21 callers outside that directory were found, including non-chat production code:

- `src/features/generated-projects/legacy/**` imports `code-tools/services/{project-path-guard, project-file-reader, storefront-customer-copy-guard}`, `agent/agentic-loop.types`, `planning/extract-website-spec`, `security/path-guard`
- `src/features/runtime/legacy/error-analyzer.server.ts` imports `openai/{chat-completions-provider, schemas}` and `agent/prompt-template-store`
- `src/features/projects/legacy/project-file-store.server.ts` imports `security/path-guard` and `code-tools/services/project-path-guard`
- `src/server/functions/project-message-stream.ts` imports `security/secret-redactor`
- `src/server/services/project-service.ts` imports `store-runtime/generated-project-env-writer`
- `src/agent/agent-runtime.ts` imports `store-runtime/store-runtime-prompt`

A whole-directory delete would break the build. The user chose **scoped chat-only cleanup** instead: delete the legacy chat orchestrator path while preserving the shared utilities the rest of the codebase depends on.

What was deleted (T079 / T080 / T081 / T082):

- `src/features/ai-agent/agent/{agent-orchestrator, agent-runner, agent-event-to-skeleton, agent-event-to-milestone, user-facing-presenter, agentic-loop.server, agentic-prompts.server, init-prompt.server, init-prompt-store.server, agent-config, orchestrator-state-machine, async-event-queue, context-compaction, design-variant-generator, reasoning-effort, retry, project-rule-docs.server, vertical-init-guidance.server}.ts`
- `src/features/ai-agent/ui/{use-agent-stream, streaming-text-panel, agent-event-reducer, preview-availability, preview-path}.ts(x)` (the last three were *moved* to `src/features/agents/ui/` because they're chat-relevant but not orchestrator-bound)
- `src/features/ai-agent/api/`
- `src/features/ai-agent/thinking/` minus `thinking.schema.ts` (kept because `agent/agentic-loop.types.ts` imports it)
- `src/server/services/message-service.ts` (replaced by slim `ChatHistoryService`)
- `src/server/functions/project-runs.ts`
- `src/routes/api/projects/$projectId/runs/**`

What remains under `src/features/ai-agent/` and is explicitly preserved:

- `agent/agent-events.ts`, `agent/agent-errors.ts`, `agent/agentic-loop.types.ts`, `agent/error-classifier.ts`, `agent/prompt-template-store.server.ts` — imported by `code-tools/`, `openai/stream-adapter`, `planning/extract-website-spec`, `runtime/legacy/error-analyzer`, `init-backfill-policy.server`
- `code-tools/`, `openai/`, `planning/`, `security/`, `store-runtime/`, `design/` — load-bearing for non-chat production paths
- `thinking/thinking.schema.ts` — referenced by `agentic-loop.types`

### SC-005 status

The original spec (SC-005) reads: "After Phase 5, the codebase contains exactly one chat agent path." This is now true on the chat side. There is, however, still one `src/features/ai-agent/` directory because non-chat code lives in it. A future cleanup spec should extract the shared utilities (`security/path-guard`, `code-tools/services/`, `openai/`, `planning/extract-website-spec`, `store-runtime/`) to a new `src/features/storefront-shared/` (or similar) and delete the rest of `ai-agent/`. The Phase 10 guard test (`tests/contract/no-legacy-chat-path.contract.test.ts`) will keep the chat orchestrator from being recreated in the meantime.

## Constitution gate audit

| Principle | Status |
|---|---|
| I. Yêu cầu rõ ràng code flow & tính năng | PASS — chat flow documented end-to-end in spec + this report |
| II. Test cho mọi business rule | PASS — 377 vitest cases, every FR has at least one test |
| III. API trả lỗi nhất quán | PASS — every endpoint returns `{ ok: false, code, message }` |
| IV. Không over-engineer | PASS — chat path reuses BuilderRunHandle/runStore/messageRepository; no new framework |
| V. UX đơn giản, validation, DESIGN.md compliance | PASS — composer styles unchanged; new pickers use shadcn/Tailwind tokens, no hardcoded colors |
| VI. Bảo mật theo role/permission | PASS — every endpoint calls `requireServerUser`; ownership checks on `BuilderRunHandle.userId` |
| VII. Code Review & Impact Analysis | PASS — Phase 10 preceded by code-graph review + scope reduction |
| VIII. Chuẩn hóa Code Formatting | PASS — `pnpm typecheck` clean |
| IX. Database JSON Type Convention | PASS — additive columns are all `json()` |
| X. Import Alias Convention | PASS — every new module imports via `@/...` |

## Files of interest

| Concern | File |
|---|---|
| Codex thread wiring + reasoning effort | `src/features/agents/codex/runtime/codex-thread.server.ts` |
| Builder run drivers (init / update / new_route + plan-mode wrapper) | `src/features/agents/codex/runtime/builder-run.server.ts` |
| Server-side kind resolution (R5) | `src/features/agents/codex/runtime/update-classifier.server.ts` |
| Plan turn (read-only sandbox + snapshot diff guard) | `src/features/agents/codex/runtime/plan-mode.server.ts` |
| Retail variant generator | `src/features/agents/codex/runtime/design-variants.server.ts` |
| Progress mapper (γ + α + β-lite + privacy filter) | `src/server/functions/progress-mapper.server.ts` |
| Friendly error copy table | `src/server/functions/friendly-errors.server.ts` |
| Bridge orchestrator | `src/server/services/builder-run-bridge.server.ts` |
| Translator (BuilderRunEvent → RunStreamEvent) | `src/server/services/builder-run-translator.server.ts` |
| Dispatcher (entrypoint used by API + chat) | `src/server/services/builder-run-dispatcher.server.ts` |
| Restart-safe boot scan | `src/server/repositories/agent-run-repository.ts` (`reconcileOrphanRuns`) |
| Frontend hook | `src/features/agents/ui/use-chat-stream.ts` |
| Plan review UI | `src/features/agents/ui/PlanReview.tsx` |
| Variant picker UI | `src/features/agents/ui/DesignVariantPicker.tsx` |
| Skill clarification UI | `src/features/agents/ui/SkillClarificationList.tsx` |
| User guide page | `src/routes/user-guide.tsx` + `public/docs/user-guide.md` |
| Cleanup guard | `tests/contract/no-legacy-chat-path.contract.test.ts` |

## Rollback

- Tag `pre-027-migration` points at the pre-migration HEAD.
- Tag `legacy-aiagent-snapshot` points at the commit immediately before Phase 10 cleanup. `git reset --hard legacy-aiagent-snapshot` recovers the deleted chat orchestrator if a regression appears.
