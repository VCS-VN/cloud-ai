# Implementation Plan: Project Cart Generation

**Branch**: `018-project-cart-generation` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-project-cart-generation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Generated project-detail storefronts will replace cart placeholder behavior with a real cart runtime that supports guest and authenticated shoppers, product-detail-only cart mutation, cart page selection, header count, and checkout navigation in cart-origin mode.

Technical approach: extend the AI Agent initial storefront source generator, init prompt, runtime prompt, and generated file layout so new storefront projects include `AuthProvider`, an active `CartProvider`, cart selection state, cart API service contracts, wired product detail add/update behavior, cart page selection UI, header count badge, and checkout summary preparation. Preserve existing generated HTTP client interceptor behavior and route all storefront API requests through the shared client.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node.js 25  
**Primary Dependencies**: React 19, TanStack Start/Router, TanStack Query, Axios, Jotai, Sonner, Lucide, Tailwind CSS, DOMPurify, Lodash  
**Storage**: Generated storefront browser local storage for guest cart; account cart stored by existing backend cart service; no Builder database schema changes  
**Testing**: Vitest unit tests for generated source strings and policy checks; existing `pnpm lint` TypeScript validation  
**Target Platform**: Web application builder that generates retail storefront project-detail workspaces  
**Project Type**: Web application with server-side AI Agent orchestration and generated storefront workspaces  
**Performance Goals**: Cart initialization must wait only for store/profile readiness; UI cart changes must be visible immediately after shopper action; generated validation must stay within normal fast validation loop  
**Constraints**: Product detail is the only add/update entry point; account mutation responses are ignored for current UI state; no rollback or error toast on persistence failure; UI must obey each generated project's `DESIGN.md`; all generated API calls use existing `apiClient` interceptors; no new cart drawer scope  
**Scale/Scope**: New generated storefront files and prompts for all future project-detail storefront initialization; initial account cart load uses page 1 and limit 100; one browser guest cart key shared across generated projects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I - Clear feature and code flow**: PASS. Plan separates generated UI, generated providers, cart service calls, prompt contracts, and selection state.
- **Principle II - Tests for important business rules**: PASS. Plan requires tests for provider order, guest/user branching, selected model behavior, cart merge/update rules, and prompt/source contract strings.
- **Principle III - Consistent API errors**: PASS. No backend API implementation is changed; generated client continues using existing API error normalization and interceptor flow.
- **Principle IV - No over-engineering**: PASS. Uses existing generated app providers, React Query, Axios client, Jotai dependency, and local storage; no new subsystem beyond cart/auth runtime files.
- **Principle V - UX validation and design system compliance**: PASS. Generated cart UI must follow project `DESIGN.md` and avoid hardcoded visual literals.
- **Principle VI - Role/permission security**: PASS. Auth profile only determines shopper mode; logout and unauthorized profile cleanup clear local credentials.
- **Principle VII - Code review graph priority**: PASS. Implementation review should inspect AI Agent source/prompt impact before editing generator files.
- **Principle VIII - Formatting**: PASS. Implementation phase must run existing typecheck/lint.
- **Principle IX - Database JSON convention**: PASS. No database schema changes.
- **Principle X - Import alias convention**: PASS. New imports across generated and Builder source must use `@/` or `@app/`; same-folder imports may use `./`.

## Project Structure

### Documentation (this feature)

```text
specs/018-project-cart-generation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cart-api-contract.md
│   ├── generated-cart-runtime-contract.md
│   └── ai-agent-generation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/features/ai-agent/
├── agent/
│   └── init-prompt.server.ts
├── store-runtime/
│   └── store-runtime-prompt.ts
└── source/
    ├── generated-project-layout.ts
    ├── init-source.server.ts
    └── package-registry.ts

src/features/ai-agent/code-tools/
├── services/
│   └── generated-api-client-policy.server.ts
└── code-agent-prompts.server.ts

src/features/ai-agent/source/__tests__/ or existing test location
└── generated cart/auth source contract tests

AGENTS.md
```

Generated storefront files affected by source/prompt output:

```text
src/app/auth-provider.tsx
src/app/cart-provider.tsx
src/app/cart-selection.ts
src/routes/__root.tsx
src/routes/products/$productId.tsx
src/routes/cart.tsx
src/routes/checkout.tsx
src/components/layout/site-header.tsx
src/components/store/cart-item.tsx
src/services/http/client.ts
```

**Structure Decision**: Extend the existing AI Agent generated-source and prompt surfaces. The source generator already owns initial storefront files, provider order, header, product detail, cart route, checkout route, HTTP client, and generated layout list. This feature updates those surfaces rather than adding a parallel generator.

## Phase 0: Research

Completed in [research.md](./research.md).

Key decisions:
- Use provider order `Providers -> StoreProvider -> AuthProvider -> CartProvider`.
- Use `AuthProvider` profile readiness to determine guest versus account cart mode.
- Use the existing generated Axios `apiClient` and interceptors for profile and cart calls.
- Keep guest cart under fixed local storage key `store_cart` using the same cart shape as account mode.
- Use selected product model id as cart item identity across add, update, remove, and bulk merge.
- Product detail requires explicit model selection; default model only drives display price.
- Account cart UI updates happen before persistence and do not rollback or notify on persistence failure.
- Cart page selection stores selected item ids globally; checkout resolves item details from current cart state.

## Phase 1: Design & Contracts

Generated artifacts:
- [data-model.md](./data-model.md)
- [contracts/cart-api-contract.md](./contracts/cart-api-contract.md)
- [contracts/generated-cart-runtime-contract.md](./contracts/generated-cart-runtime-contract.md)
- [contracts/ai-agent-generation-contract.md](./contracts/ai-agent-generation-contract.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Principle I**: PASS. Contracts document generated provider flow, account/guest mode, cart actions, and API boundaries.
- **Principle II**: PASS. Quickstart defines validation scenarios for key business rules; data model captures state transitions.
- **Principle III**: PASS. Generated runtime continues through shared client interceptor/error normalization; no backend error format changes.
- **Principle IV**: PASS. Research rejects extra drawer/order/payment scope and full selected item snapshots.
- **Principle V**: PASS. UI contract requires generated components to use project design rules and token-safe controls.
- **Principle VI**: PASS. Auth cleanup and logout behavior are explicit; no new role/permission claims are introduced.
- **Principle VII**: PASS. Source structure identifies generator and prompt impact surfaces for graph-assisted review.
- **Principle VIII**: PASS. Quickstart requires `pnpm lint`.
- **Principle IX**: PASS. No database changes.
- **Principle X**: PASS. Contracts require alias imports for generated code.

## Complexity Tracking

No constitution violations.
