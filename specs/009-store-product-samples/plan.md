# Implementation Plan: Store and Product Sample Data

**Branch**: `009-store-product-samples` | **Date**: 2026-05-14 | **Spec**: `specs/009-store-product-samples/spec.md`
**Input**: Feature specification from `specs/009-store-product-samples/spec.md`

**Note**: This plan defines how AI Agentic should generate sample store/product data and update sample values safely from later user prompts without changing structure.

## Summary

Add a deterministic sample-data capability for generated storefront projects. After pages and components are created, AI Agentic creates store data, product data, and a products-list wrapper using the exact structures supplied by the user. Later prompts may change values, add products, remove products, or reorder products, but must preserve the Store, Product, ProductModel, embedded StoreSnapshot, ReviewSummary, Category, and ProductsList shapes exactly. Product updates match by stable product `id` first, and each product's `entityId` must equal its `id`.

## Technical Context

**Language/Version**: TypeScript 6.0.3  
**Primary Dependencies**: React 19, TanStack Router/Start, Vite, Vitest, Zod  
**Storage**: Project-generated files and existing PostgreSQL project state; no new database tables required for this feature  
**Testing**: Vitest plus `pnpm lint`/`pnpm typecheck`  
**Target Platform**: Web application project generator and preview runtime  
**Project Type**: Full-stack TypeScript web application with AI project generation service  
**Performance Goals**: Sample data generation and targeted update planning complete in under 2 seconds for up to 50 products  
**Constraints**: Must not alter sample data structure; must use `@/` or `@app/` aliases for cross-folder imports; JSON structures must preserve key names and nullable fields  
**Scale/Scope**: One active generated project at a time; default initialization creates at least 6 products; prompt updates support up to 50 sample products per products list

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I - Clear flow**: PASS. Plan separates AI prompt interpretation, sample data rules, generated project files, and validation.
- **Principle II - Tests for business rules**: PASS. Tasks must include tests for structure preservation, `entityId === id`, ID-based updates, and ambiguous prompt clarification.
- **Principle III - API errors**: PASS. No new public API endpoint required. If existing server functions surface validation errors, use existing error format.
- **Principle IV - No over-engineer**: PASS. Use static structure definitions and validation helpers; no new persistence layer or schema migration.
- **Principle V - UX validation/design**: PASS. No new design-system UI required unless existing prompt UX displays clarification messages.
- **Principle VI - Role/permission security**: PASS. Feature operates within existing project ownership flows; no login changes.
- **Principle VII - Code graph review**: PASS. Implementation phase should inspect impacted agent/generation flows before edits.
- **Principle VIII - Formatting**: PASS. Run existing formatting/typecheck commands before completion.
- **Principle IX - Database JSON convention**: PASS. No new DB JSON fields planned. If any existing JSON write is touched, keep `json`, not `jsonb`.
- **Principle X - Import alias**: PASS. Plan requires `@/` or `@app/` for cross-folder imports.

## Project Structure

### Documentation (this feature)

```text
specs/009-store-product-samples/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sample-data-update-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── agent/
│   ├── agent-runtime.ts
│   ├── agent-tool-registry.ts
│   └── project-workspace-service.ts
├── ai/
│   ├── prompt-builder.ts
│   └── output-parser.ts
├── server/
│   ├── functions/
│   │   └── project-message-stream.ts
│   └── services/
│       └── project-run-service.ts
├── shared/
│   └── project-types.ts
└── components/
    └── projects/
        └── MessageComposer.tsx

tests/
└── setup.ts
```

**Structure Decision**: Single TypeScript web application. The likely implementation lives in the existing AI generation flow and shared project types. Add tests near changed modules or existing adjacent tests. Do not introduce new packages, migrations, or app roots.

## Phase 0: Research Findings

See `research.md` for decisions.

## Phase 1: Design Artifacts

- `data-model.md`: Exact Store, Product, ProductModel, ProductsList structures, invariants, and validation rules.
- `contracts/sample-data-update-contract.md`: Contract for initialization and prompt-based updates.
- `quickstart.md`: Verification steps for init generation, update prompts, and validation.

## Post-Design Constitution Check

- **Clear flow**: PASS. Data model and contract define initialization, update, and validation boundaries.
- **Business-rule tests**: PASS. Data invariants are explicit and testable.
- **No over-engineer**: PASS. Artifacts avoid new storage or generalized schema engines.
- **Alias convention**: PASS. Any implementation must use `@/` or `@app/` for cross-folder imports.
- **Formatting**: PASS. Quickstart includes typecheck/test commands.

## Complexity Tracking

No constitution violations require justification.
