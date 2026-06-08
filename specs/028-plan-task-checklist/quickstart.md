# Quickstart: Plan Task Checklist

**Feature**: `028-plan-task-checklist` | **Date**: 2026-06-08
**Audience**: Reviewer or developer verifying the feature on local dev before merge.

This document is a manual smoke checklist that exercises the user-facing surface end-to-end. It is the last gate before considering the feature shippable. Run this AFTER `pnpm typecheck` + `pnpm vitest run` are clean.

---

## Setup

```bash
# 1. Pull latest, install
git checkout 028-plan-task-checklist
pnpm install --frozen-lockfile

# 2. Verify required env (no secrets — names only)
#   CODEX_API_KEY        — set
#   CODEX_BASE_URL       — set
#   CODEX_HOME           — set
#   CODEX_MODEL          — set
#   DATABASE_URL         — set

# 3. Run dev
pnpm dev
```

Open the dev URL printed by Vite. Sign in if needed. Have at least one project ready (or be ready to create one for the init flow).

---

## Scenario 1 — Complex update prompt shows checklist (US1, FR-002, FR-006, FR-012)

1. Open an existing project's chat panel.
2. With **plan mode OFF** in the composer, submit a multi-step prompt:
   `"Add a sticky header, a hero banner with image, and a featured products grid"`
3. Within ~10 seconds, observe:
   - The `loading_context` skeleton phase appears as before.
   - Shortly after, a sticky card appears between the messages list and the composer with 2-8 task rows.
   - Each task row shows a status icon (○ pending, ◐ in-progress with spinner, ⏸ paused, ✓ completed) and the task title.
   - The header reads `[chevron] [icon] [N/total: <active task title>]` — but expanded by default, so the row body is also visible.
4. As the run progresses through milestones, observe at least one task transitioning from pending → in-progress → completed.
5. When the run completes, every task icon shows `✓` and animation stops.

**Expected pass**: All 5 sub-points hold. No file paths or framework names appear in any task title.

**On failure**: Capture the network tab's `/stream` SSE messages. Look for `plan.created` event and subsequent `plan.task.*` events. If `plan.created` is missing, the classifier or planner failed silently — check server logs for `plan_classifier_decision` and `plan_generator_validation_failed`.

---

## Scenario 2 — Simple prompt skips the checklist (US2, FR-001, FR-009)

1. With plan mode OFF, submit a trivial single-step prompt:
   `"Change the hero subtitle to 'Sale ends Friday'"`
2. Observe:
   - No checklist card appears.
   - The existing single-label progress UI (skeleton in agent message bubble) renders as before.
3. Wall-clock from prompt submit to first progress signal feels comparable to runs from before this feature.

**Expected pass**: No checklist visible. Existing UX intact for trivial work.

**On failure**: Inspect server log for `plan_classifier_decision`. If `complexity: "complex"` was logged, the classifier mislabeled the prompt — file an issue but do not block this PR (lenient fallback per FR-009 is intentional).

---

## Scenario 3 — Collapse / expand interaction (US3, FR-013)

1. From a complex run with a checklist visible (Scenario 1), click the chevron icon in the checklist header.
2. Observe:
   - The full task list collapses.
   - The header becomes a single line: `[icon] N/total: <active task title>` while running, or `[✓] Completed N of N tasks` after termination.
3. Click the chevron again. The full list re-expands.
4. Repeat the toggle multiple times — no flicker, no state loss.

**Expected pass**: Toggle is instant, state is preserved, no visual regression.

---

## Scenario 4 — Pause/resume on clarification (US4, FR-007)

1. Submit a prompt that triggers a skill clarification mid-run, OR an init flow that triggers variant pick.
2. When `awaiting_clarification` fires, observe:
   - The currently active task icon (`◐` animated) flips to `⏸` (static pause icon).
   - The clarification panel appears in chat as before.
3. Submit the clarification answer.
4. Observe the previously paused task icon returns to `◐` (animated) and the run continues.

**Expected pass**: Spinner stops while the agent waits on user input — honest UX per "không đoán bừa, không tự ảo giác".

**Note**: For init flow's variant pick, the pause happens BEFORE plan generation, so no task list exists at pause time. Pause-on-clarification only applies to clarifications fired AFTER plan.created.

---

## Scenario 5 — Plan mode skips the task list (US5, FR-011)

1. Toggle plan mode **ON** in the composer.
2. Submit a prompt: `"Build a new about page with team photos and bio paragraphs"`
3. Observe the markdown plan appears with Approve/Reject buttons (existing behavior, unchanged).
4. Click **Approve**.
5. Observe:
   - **NO** checklist card appears.
   - The existing single-label progress UI renders during execute.

**Expected pass**: Plan mode unchanged. No `plan.created` event in network tab.

**On failure**: Look for `plan.created` event in `/stream` SSE messages. If present, the driver did not honor the `ctx.planMode === true` skip.

---

## Scenario 6 — Language matches user prompt (US6, FR-004)

1. With plan mode OFF, submit a Vietnamese prompt:
   `"Tạo trang chủ với ảnh hero, danh sách sản phẩm, và footer có liên kết mạng xã hội"`
2. Observe every task title is in Vietnamese.
3. Status text (when hover/aria), section landmark, and live-region announcements remain English.
4. Repeat with an English prompt — task titles English.

**Expected pass**: Task titles match prompt language; UI infrastructure text remains English regardless.

---

## Scenario 7 — Reload mid-run replays state (FR-016, SC-007)

1. Submit a complex prompt (Scenario 1).
2. While the run is mid-flight (multiple tasks visible, at least 1 completed), hard-reload the browser tab (Cmd+Shift+R / Ctrl+Shift+R).
3. After the page rehydrates, observe:
   - The same task list renders.
   - Task statuses match what was visible at the moment of reload (subject to the publish-first trade-off — the very last transition before reload may be missing if it was published but not yet persisted).
   - Live updates resume — newly arriving transitions tick the appropriate task.

**Expected pass**: Replay reproduces task state to within one transition of live truth.

---

## Scenario 8 — Cancel during plan generation (FR-010)

1. Submit a complex prompt.
2. Within ~2-5 seconds (during classifier or planner turn, before `plan.created` appears), click the Cancel button.
3. Observe:
   - The run terminates with `cancelled` status.
   - No task list appears.
   - The cancel completes within ~1 second of the click (AbortSignal propagates to the codex turn).

**Expected pass**: Cancel is fast; no zombie state.

---

## Scenario 9 — Server restart mid-run (FR-008, edge case)

This scenario requires server access — typically run on the VPS or a manual local restart.

1. Submit a complex prompt and wait until at least 2 tasks are visible.
2. From the server side (PM2 or equivalent), restart the app process.
3. Observe in the browser:
   - The run is marked `interrupted` (banner appears).
   - The checklist remains visible with task statuses preserved up to the last persisted transition.
   - No animated spinner — `state.activeRun === null` (run closed) means no animation.
4. Click retry (if available). A new run starts with a fresh classifier+planner turn and a new task list.

**Expected pass**: Interrupted state is honest and recoverable via retry.

---

## Scenario 10 — Privacy filter rejects path-leaking title (FR-003, SC-003)

This is harder to reproduce manually because it requires the LLM to actually leak. The unit test `tests/unit/plan-generator.test.ts` covers this exhaustively. Manual check is OPTIONAL:

1. Force a planner turn that has a high chance of leaking by submitting a code-heavy prompt:
   `"Update src/routes/__root.tsx to add a global error boundary using React.lazy"`
2. Observe either:
   - The classifier marks this `simple` (likely; technical prompts often look simple) and no checklist generates.
   - OR the planner runs, the validator rejects the leaking title, retry succeeds with cleaned titles, and the visible checklist contains NO file paths or framework names.

**Expected pass**: No leaking title surfaces in the visible checklist under any conditions.

---

## Quick verification matrix

| Scenario | Spec ref | Pass criterion |
|---|---|---|
| 1. Complex → checklist | US1, FR-002, FR-012 | Checklist appears within 10s; transitions visible |
| 2. Simple → no checklist | US2, FR-001 | No checklist; existing UX intact |
| 3. Collapse/expand | US3, FR-013 | Toggle works, no flicker |
| 4. Pause/resume | US4, FR-007 | Spinner stops on clarification, resumes on answer |
| 5. Plan mode skips | US5, FR-011 | No checklist when plan mode ON |
| 6. Language match | US6, FR-004 | Task titles match prompt language; UI English |
| 7. Reload mid-run | FR-016 | Replay reproduces statuses |
| 8. Cancel during plan | FR-010 | Fast cancel, no zombie |
| 9. Restart mid-run | FR-008 | Interrupted state preserved |
| 10. Privacy filter | FR-003, SC-003 | No leaking titles surface |

---

## Recording

When reporting back:
- Confirm each scenario PASS or FAIL.
- For any FAIL, attach: server log snippet around `plan_*` log events, browser network tab `/stream` SSE messages, screenshot of the bad state.
- For PASS-with-degradation (e.g., classifier mislabel), note it as observation but do not block the PR — lenient fallback is intentional.

## After all scenarios pass

- Run full Vitest suite: `pnpm vitest run` — all ≥ 394 + 13 new cases pass.
- Run `pnpm typecheck` and `pnpm lint` — clean.
- Open PR per repo template.
