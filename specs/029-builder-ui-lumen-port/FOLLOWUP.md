# Feature 029 — Follow-ups (post-merge)

These items were intentionally deferred from feature 029 scope. Track and execute in separate PRs.

## FU-1: Bump root constitution to 1.5.0 — clarify Principle V scope

**File**: `.specify/memory/constitution.md`
**Current version**: 1.4.x
**Target version**: 1.5.0

**Why**: Principle V ("Design taste as inviolable layer") currently reads as if it covers all UI surfaces uniformly. Feature 029 surfaced that storefront generated UI (`templates/storefront/*/DESIGN.md`) and builder UI (`app/styles/` + `src/components/ui/`) have different sources of truth, different primitive constraints, and different review cadences. Treating them as one bucket forces awkward exceptions.

**Change**: Split Principle V into two sub-clauses:
- **V.a — Storefront**: `templates/storefront/*/DESIGN.md` is the authoritative source per-template; runtime prompt-builder honors it; `.agents/skills/design-taste-frontend` is dev-only and not loaded by runtime (cf. memory `project_skill_runtime_gap`).
- **V.b — Builder UI**: `app/styles/{tokens,components,index}.css` + `tailwind.config.ts` is source of truth; all primitives go through `src/components/ui/*` (shadcn convention with cva variants rendering Lumen classes); no shadcn baseColor variables in production primitives.

**Out of scope for FU-1**: changing actual storefront or builder code; this is documentation-only.

## FU-2: tokens.json + 6 HTML reference files left out of repo (intentional)

**Status**: not a defect — covered by FR-021 in `spec.md`.
Source folder: `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/`
If onboarding a new contributor, copy that folder for visual reference; do not commit.

## FU-3: Constitution conflict pattern — formalize "override PR" mechanism

Both T078 (INV-5 cross-tree sweep inside PR3b) and PR3c (SC-009 sweep across `src/components/{auth,projects}/` + `src/features/agents/ui/`) used an ad-hoc "override PR" pattern when a Success Criterion crossed Allowed-list boundaries. Worth documenting as a first-class mechanism in the spec-kit so future multi-PR features have a sanctioned escape hatch instead of inventing it twice.

Related memory: `feedback_sc_scope_match_allowed.md`.
