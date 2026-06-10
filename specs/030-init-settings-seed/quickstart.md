# Quickstart: Init Settings Seed

## Goal

Validate that a new Codex SDK init run prepares project settings before Agent generation, installs dependencies, and keeps protected files out of Agent changes.

## Manual Validation

1. Start from an empty generated project workspace.
2. Run a new init builder run with a storefront prompt.
3. Confirm runtime setup happens before Agent build batches:
   - runtime-owned settings exist before Agent generation
   - editable baseline files exist before Agent generation
   - dependency directory and lockfile exist before baseline snapshot
4. Confirm Agent-generated changes do not include runtime-owned settings or lockfile.
5. Confirm Agent can edit:
   - `src/styles/app.css`
   - `src/routes/__root.tsx`
6. Confirm Agent cannot edit:
   - `package.json`
   - `vite.config.ts`
   - `tsconfig.json`
   - `tailwind.config.ts`
   - `postcss.config.cjs`
   - `src/router.tsx`
   - lockfiles
7. Confirm build validation passes after Agent routes/components are created.
8. Confirm preview health passes without manually adding settings files.

## Conflict Validation

1. Create a generated workspace with `package.json` content that differs from the seed template.
2. Start init.
3. Confirm init stops before Agent execution.
4. Confirm failure identifies the conflicting runtime-owned path.
5. Confirm file was not overwritten.

## Resume Validation

1. Run init until editable files exist and include Agent edits.
2. Start a retry/resume path.
3. Confirm runtime-owned identical settings are accepted.
4. Confirm existing editable baseline files are left unchanged.
5. Confirm dependency install is skipped when dependency directory and lockfile are present.

## Expected Outcome

Generated storefront init produces a preview-ready project baseline without asking the Agent to create protected project settings.
