# Research: Init Settings Seed

## Decision: Runtime seeds settings before Agent execution

**Rationale**: Init must create a buildable storefront baseline before the Agent creates routes and components. Runtime owns package/config/router files, so seeding them outside the Agent preserves protected-path boundaries and avoids diff-gate rejection.

**Alternatives considered**:
- Let Agent create settings: rejected because current protected-path rules reject those edits and settings become nondeterministic.
- Add settings to init manifest/batches: rejected because manifest batches are Agent scope and would encourage blocked-path edits.
- Reuse legacy scaffold: rejected because it brings unrelated boilerplate and does not match the Codex SDK init path.

## Decision: One Markdown template per target file

**Rationale**: Independent templates make each target file explicit and reviewable. Frontmatter declares the target path; raw body preserves exact file content without code-fence parsing risk.

**Alternatives considered**:
- Markdown code fences: rejected because fence parsing can leak wrappers or indentation.
- Filename-only mapping: rejected because it lacks target mismatch validation.
- Dynamic placeholder templates: rejected for v1 because the chosen design keeps protected config static and routes theme customization through editable CSS.

## Decision: Split runtime-owned settings from Agent-editable baselines

**Rationale**: Package/config/router files must be deterministic and protected. Global CSS and root route need runtime baseline creation but must remain Agent-editable for theme tokens, providers, header/footer, and layout wiring.

**Alternatives considered**:
- Block root route and global CSS: rejected because the Agent must wire storefront layout and theme.
- Let Agent create root route/global CSS from scratch: rejected because missing CSS import or root route can break early build/setup assumptions.
- Overwrite editable baselines every run: rejected because retry/resume would lose Agent work.

## Decision: Minimal SEO-capable storefront baseline

**Rationale**: Generated storefronts may be published publicly. Baseline must support crawler-readable page structure and metadata capability while avoiding unrelated backend, testing, database, deployment, AI, and PWA dependencies.

**Alternatives considered**:
- Pure client-only storefront: rejected because public SEO and social crawling are weaker.
- Copy main application config: rejected because it includes many unrelated dependencies and runtime responsibilities.

## Decision: Install dependencies after seed and before snapshot

**Rationale**: Package metadata must exist before install. Dependency artifacts and lockfile should become runtime baseline, not Agent changes. Running install before Agent avoids wasting generation turns on an unbuildable workspace.

**Alternatives considered**:
- Install after snapshot: rejected because lockfile changes would be attributed after baseline and conflict with protected-path rules.
- Always install on every run: rejected because retry/resume should be faster when dependency directory and lockfile are present.
- Seed lockfile template: rejected because lockfiles are large, brittle, and should be produced by package manager.

## Decision: No protected-path changes

**Rationale**: Existing protected paths already cover runtime-owned settings and lockfiles. Editable baseline paths are already outside blocked settings and inside allowed project scopes.

**Alternatives considered**:
- Unblock styling config: rejected because theme customization can happen through editable CSS tokens.
- Add client/server entrypoints to blocked paths: rejected because they are not seeded in this feature.
