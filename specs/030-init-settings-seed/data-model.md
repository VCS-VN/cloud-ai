# Data Model: Init Settings Seed

## SeedTemplate

Represents one Markdown template used to seed one project file.

**Fields**:
- `templatePath`: Project-relative path to template file.
- `target`: Project-relative generated workspace target path declared in frontmatter.
- `body`: Exact file content to write after frontmatter stripping.
- `category`: `runtime-owned-setting` or `editable-baseline`.

**Validation Rules**:
- `target` must exist in frontmatter.
- `target` must match the expected target for the template entry.
- `target` must be relative.
- `target` must not contain parent-directory traversal.
- `body` must be preserved byte-for-byte after removing frontmatter framing.

## RuntimeOwnedSetting

Protected generated-project setting owned by runtime.

**Targets**:
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tailwind.config.ts`
- `postcss.config.cjs`
- `src/router.tsx`

**State Rules**:
- Missing: write template body.
- Exists with same content: accept without changing.
- Exists with different content: stop init with conflicting runtime file failure.

## EditableBaselineFile

Runtime-created baseline that the Agent may edit later.

**Targets**:
- `src/styles/app.css`
- `src/routes/__root.tsx`

**State Rules**:
- Missing: write template body.
- Exists: leave unchanged.
- Agent may edit after baseline snapshot.

## DependencyBaseline

Installed dependency state prepared before Agent diff tracking.

**Fields**:
- `dependencyDirectoryPresent`: Whether dependency directory exists.
- `lockfilePresent`: Whether lockfile baseline exists.
- `installStatus`: `skipped`, `completed`, or `failed`.

**State Rules**:
- If dependency directory and lockfile both exist: skip install.
- If either is missing: install dependencies.
- Lockfile created by install is baseline runtime setup.
- Install failure stops init before Agent execution.

## InitWorkspace

Generated project directory prepared before Agent work.

**Relationships**:
- Contains many `SeedTemplate` target files.
- Contains one `DependencyBaseline`.
- Becomes baseline snapshot source after seeding and dependency installation.

**Lifecycle**:
1. Workspace directory exists.
2. Runtime-owned settings seeded.
3. Editable baselines seeded if missing.
4. Dependencies installed or skipped.
5. File manifest and prompt context built.
6. Baseline snapshot captured.
7. Agent creates storefront routes/components and may edit allowed baseline files.
