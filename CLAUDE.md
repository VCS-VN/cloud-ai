# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

<!-- SPECKIT START -->
**Current feature**: `027-codex-sdk-chat-migration` (status: completed 2026-06-07)
**Plan**: `specs/027-codex-sdk-chat-migration/plan.md`
**Spec**: `specs/027-codex-sdk-chat-migration/spec.md`

Chat now flows through `src/features/agents/codex/runtime/**` (codex SDK builder
runs) and the `/api/projects/$projectId/builder-runs/**` route tree. The legacy
chat orchestrator under `src/features/ai-agent/agent/**` was removed; the few
remaining files there (`agent-events.ts`, `agent-errors.ts`, `agentic-loop.types.ts`,
`error-classifier.ts`, `prompt-template-store.server.ts`) are kept because
non-chat production code (init backfill, error analyzer, code-tools events)
imports them. Do NOT add new code paths to `@/features/ai-agent/agent/`. Do NOT
recreate `@/server/services/message-service.ts` or the `/api/projects/$projectId/runs/`
route tree — `tests/contract/no-legacy-chat-path.contract.test.ts` will fail
the build if either reappears.
<!-- SPECKIT END -->
