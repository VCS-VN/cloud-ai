# Implementation Plan: Project Design Rules

**Branch**: `main` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-project-design-rules/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Retail storefront projects will receive a managed project-local `DESIGN.md` before customer-facing UI generation. The design file will combine structured source-of-truth token values with fixed guidance sections, support deterministic project-specific variety, enforce token-based UI updates, and validate design compliance for storefront UI mutations.

Technical approach: extend the existing AI-agent design generation, design file service, design-rule read gate, patch validation, and project validation flow so design rules become a validated managed artifact with deterministic token mapping and scoped storefront compliance checks.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node.js 25  
**Primary Dependencies**: React 19, TanStack Start/Router, Vite, Tailwind CSS, OpenAI provider, Vitest  
**Storage**: Project workspace files; no new database storage for Phase 1  
**Testing**: Vitest unit/integration tests plus existing `pnpm lint` typecheck  
**Target Platform**: Web application builder that generates retail storefront project workspaces
**Project Type**: Web application with server-side agent orchestration and generated storefront workspaces  
**Performance Goals**: Design generation and validation must not add noticeable delay beyond existing AI generation; static compliance checks should complete within normal validation feedback loops for changed storefront files  
**Constraints**: Retail storefront only; managed read-only `DESIGN.md`; no raw visual literals in customer-facing UI mutations; no new broad schema library; no direct user edits to design file  
**Scale/Scope**: One generated design file per retail storefront project; validates changed UI files for normal updates and full customer-facing storefront for initialization, redesign, and explicit design sync

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I - Clear feature and code flow**: PASS. Spec defines init, update, token patch, and redesign flows with scope boundaries.
- **Principle II - Tests for important business rules**: PASS. Plan requires tests for design validation, mutation gate, classification, deterministic variety, and token mapping refresh.
- **Principle III - Consistent API errors**: PASS. No new public API contract is required; agent/tool failures must return existing repairable tool errors.
- **Principle IV - No over-engineering**: PASS. Plan uses lightweight custom validators and existing services; no new database storage or broad schema framework.
- **Principle V - UX validation and design system compliance**: PASS. Feature strengthens `DESIGN.md` compliance and raw visual literal enforcement.
- **Principle VI - Role/permission security**: PASS. No auth/permission changes and no environment-secret changes.
- **Principle VII - Code review graph priority**: PASS. Implementation review should use graph impact analysis before touching orchestrator/tool flows.
- **Principle VIII - Formatting**: PASS. Implementation phase must run configured formatting/typecheck before completion.
- **Principle IX - Database JSON convention**: PASS. No database schema changes planned.
- **Principle X - Import alias convention**: PASS. New imports across folders must use `@/` or `@app/`; same-folder imports may use `./`.

## Project Structure

### Documentation (this feature)

```text
specs/017-project-design-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── design-change-classification.md
│   ├── design-file-contract.md
│   └── ui-compliance-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/features/ai-agent/
├── agent/
│   ├── agent-orchestrator.server.ts
│   ├── agentic-prompts.server.ts
│   └── init-prompt.server.ts
├── planning/
│   ├── classify-intent.server.ts
│   ├── design-intent-heuristic.ts
│   └── extract-website-spec.server.ts
└── code-tools/
    ├── code-tool-executor.server.ts
    ├── code-tool-registry.server.ts
    ├── tools/
    │   ├── project-read-design-rules.tool.server.ts
    │   └── project-run-validation.tool.server.ts
    └── services/
        ├── design-file-service.server.ts
        ├── design-generation-service.server.ts
        ├── design-rule-patch-service.server.ts
        ├── design-static-boilerplate.server.ts
        ├── design-token-extractor.server.ts
        ├── design-template-leak-validator.server.ts
        ├── design-patch-content-validator.server.ts
        ├── project-patch-service.server.ts
        ├── project-path-guard.server.ts
        └── project-validation-service.server.ts

templates/storefront/basic-ecommerce/
└── DESIGN.md

README.md
AGENTS.md
```

**Structure Decision**: Use the existing AI-agent and code-tools structure. Design generation, validation, token extraction, patch validation, and orchestration already live under `src/features/ai-agent`, so this feature extends those services instead of adding a new subsystem. Documentation artifacts stay under `specs/017-project-design-rules`.

## Phase 0: Research

Completed in [research.md](./research.md).

Key decisions:
- Generate project-local design rules before storefront UI.
- Use hybrid structured tokens plus fixed prose sections.
- Keep Phase 1 token schema closed with stable role names.
- Use deterministic controlled variety from project identity and prompt fingerprint.
- Treat design rules as managed read-only artifacts.
- Gate customer-facing UI mutation on loaded design rules.
- Validate visual drift with context-scoped static scans.
- Use lightweight custom validation rather than a broad schema library.

## Phase 1: Design & Contracts

Generated artifacts:
- [data-model.md](./data-model.md)
- [contracts/design-file-contract.md](./contracts/design-file-contract.md)
- [contracts/ui-compliance-contract.md](./contracts/ui-compliance-contract.md)
- [contracts/design-change-classification.md](./contracts/design-change-classification.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Principle I**: PASS. Contracts separate design file, UI compliance, and design-change classification flows.
- **Principle II**: PASS. Data model and quickstart identify independently testable validation paths.
- **Principle III**: PASS. Failure contracts require repairable tool errors without changing public API shape.
- **Principle IV**: PASS. Research confirms lightweight validation and existing-service extension.
- **Principle V**: PASS. UI compliance contract directly enforces design-system compliance.
- **Principle VI**: PASS. No sensitive env or permission changes.
- **Principle VII**: PASS. Source structure identifies orchestrator and tool impact surfaces for review.
- **Principle VIII**: PASS. Implementation remains within existing formatting/typecheck workflow.
- **Principle IX**: PASS. No database changes.
- **Principle X**: PASS. Implementation must obey alias import convention.

## Complexity Tracking

No constitution violations.
