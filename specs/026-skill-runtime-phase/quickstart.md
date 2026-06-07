# Quickstart — Generic Skill Runtime (Phase 2)

This guide walks through validating Phase 2 against the spec's success criteria after the implementation has landed. It is intended for the operator running the manual smoke checklist — not for end-users.

## Prerequisites

- Phase 1 builder-runs stack is deployed and green (`pnpm typecheck && pnpm test` clean from branch `025-codex-sdk-migration`).
- VPS has the deploy-vps env vars set, including `SKILLS_ROOT=/var/bin/skills` (or `process.cwd()/skills` in dev).
- Phase 2 branch (`026-skill-runtime`) merged and the new Drizzle migration applied via `pnpm db:migrate`.

## Step 1 — Verify the seed skill is loaded

```bash
ls /var/bin/skills/design-taste-frontend/SKILL.md   # exists, mode 750
```

After app restart, look for the boot-time audit entry:

```
event: skill_registry_loaded
count: 1
```

A `1` reflects the seeded `design-taste-frontend`. A `0` indicates the registry didn't find it.

## Step 2 — Init run injects the skill (US1)

Submit any init prompt against an empty project. Watch the SSE stream:

```
loading_context → planning → creating_draft → building_pages → checking_preview → publishing → done
```

The stream MUST NOT include `awaiting_clarification` (no ambiguity since `design-taste-frontend` is `requiredSkills` and unique). Inspect the run row:

```sql
SELECT selectedSkills FROM builder_runs WHERE id = '<runId>';
-- Expected:
-- [
--   {
--     "name": "design-taste-frontend",
--     "source": "template_required",
--     "score": 100,
--     "hash": "<64-char hex>",
--     "loaded": true
--   }
-- ]
```

The hash MUST match `sha256` of the post-truncation skill body on disk.

## Step 3 — Confirm UI renders the published storefront

Open the project's preview URL after the run completes. The 5 core routes (`/`, `/products`, `/products/:sampleProductId`, `/cart`, `/checkout`) return 200, and the design reflects the design-taste anti-slop rules (typographic hierarchy, no AI-generic gradient placeholders, etc).

This validates SC-001 (skill auto-applies to init runs).

## Step 4 — Required-skill missing fail-fast (US4)

Temporarily move the seed skill aside:

```bash
sudo mv /var/bin/skills/design-taste-frontend /var/bin/skills/_design-taste-frontend.bak
sudo systemctl restart cloud-ai-builder    # or: pm2 restart cloud-ai-builder
```

Submit an init prompt. SSE stream:

```
failed (failureCode: required_skill_unavailable)
```

Verify on disk:

```bash
ls /var/bin/projects/<projectId>/drafts/
# Expected: empty (no draft was created)
```

The user-visible SSE message MUST be Vietnamese-primary "Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent."

Restore + restart:

```bash
sudo mv /var/bin/skills/_design-taste-frontend.bak /var/bin/skills/design-taste-frontend
sudo systemctl restart cloud-ai-builder
```

This validates SC-004.

## Step 5 — Clarification flow (US2)

Provision a second skill that overlaps with `design-taste-frontend`:

```bash
sudo cp -r /var/bin/skills/design-taste-frontend /var/bin/skills/design-taste-experimental
sudo "${EDITOR:-vim}" /var/bin/skills/design-taste-experimental/SKILL.md
# In frontmatter: change `name:` to design-taste-experimental, add same triggers + appliesTo
sudo systemctl restart cloud-ai-builder
```

Submit a prompt that triggers both: "Redesign the homepage with a premium look and feel." Watch the SSE stream:

```
loading_context → awaiting_clarification
```

Inspect:

```bash
ls /var/bin/projects/<projectId>/drafts/
# Expected: empty (no draft was created)
```

Inspect the run row:

```sql
SELECT pendingSkills FROM builder_runs WHERE id = '<runId>';
-- Expected: 2 entries with reason ∈ {tie_break_ambiguous, tie_break_failed, policy_when_ambiguous_user_choice}
```

Submit the answer:

```bash
curl -X POST http://localhost:3000/api/projects/<projectId>/builder-runs/<runId>/answer \
  -H 'content-type: application/json' \
  -d '{"optionId":"design-taste-frontend"}'
```

Run resumes: SSE continues through `loading_context → creating_draft → ...`. `pendingSkills` clears, `selectedSkills` populates with `design-taste-frontend`. A draft directory now exists. SC-003 holds.

Cleanup:

```bash
sudo rm -rf /var/bin/skills/design-taste-experimental
sudo systemctl restart cloud-ai-builder
```

## Step 6 — Codex self-query via `project_read_skill` (US3)

This step requires a curated Codex prompt that triggers the tool. Use the dev environment (with mocks) to avoid burning real provider tokens. From a Vitest integration test or via `pnpm dev`:

```ts
// Drive a builder run whose Codex turn calls project_read_skill({ name: "design-taste-frontend" })
// Verify after the run completes:
const run = await db.select().from(builderRuns).where(eq(builderRuns.id, runId));
console.log(run[0].loadedSkills);
// Expected: [{ name: "design-taste-frontend", at: <epoch ms> }]
```

`loadedSkills[]` is name-only — it MUST NOT contain the skill body or any other metadata. SC-002 holds.

## Step 7 — Tool boundary check (US3 adversarial)

Drive a Codex turn that calls `project_read_skill({ name: "../../etc/passwd" })`. The tool returns:

```json
{ "ok": false, "code": "invalid_name", "message": "Skill name is invalid." }
```

Audit log records `skill_load_failed` reason `invalid_name`. The run's `loadedSkills[]` is unchanged. SC-007 holds.

## Step 8 — Registry boot resilience (US5)

Drop a malformed `SKILL.md`:

```bash
sudo mkdir -p /var/bin/skills/broken
echo 'this is not yaml frontmatter' | sudo tee /var/bin/skills/broken/SKILL.md
sudo systemctl restart cloud-ai-builder
```

Boot logs show:

```
event: skill_registry_loaded   count: 1   (only design-taste-frontend, broken skipped)
event: skill_load_failed       name: broken   reason: parse_error
```

App responds normally to non-builder endpoints. Submitting an init prompt still works (the broken skill is not in any active template's `requiredSkills`). SC-005 holds.

Cleanup:

```bash
sudo rm -rf /var/bin/skills/broken
sudo systemctl restart cloud-ai-builder
```

## Smoke test summary

After the eight steps above:
- SC-001 confirmed (Step 2).
- SC-002 confirmed (Step 6 — `loadedSkills` is name-only).
- SC-003 confirmed (Step 5 — answer-to-resume latency observed manually).
- SC-004 confirmed (Step 4 — fail-fast before draft).
- SC-005 confirmed (Step 8 — registry boots with broken entry).
- SC-006 — covered by the table-driven detector + tie-break tests in `tests/integration/agents/codex/skill-tie-break-fallback.test.ts`. Verify via test suite.
- SC-007 confirmed (Step 7 — tool boundary).
- SC-008 — covered by inspecting any run row showing both `selectedInstructions[]` and `selectedSkills[]` populated. Phase 1 templates that have not been migrated still inject via `<selected_instruction>`.
- SC-009 — verify via `git diff --stat 025-codex-sdk-migration..026-skill-runtime` shows zero changes under `src/routes/projects/$projectId.tsx` or any file under `src/features/ai-agent/*`.
- SC-010 — `pnpm db:migrate` from the prior schema state lands the new columns; existing rows read normally.

## When to invoke this guide

- After every Phase 2 release to staging or prod.
- When debugging a "skill didn't apply" report — Step 1 + Step 2 narrow it down to registry vs detector vs injection in under 5 minutes.
- When auditing a security-sensitive change to the tool boundary — Step 7 is the canonical regression test.
