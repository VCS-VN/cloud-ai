# Implementation Plan: Storefront Lens System (Design Variance)

**Branch**: `main` (spec dir `019-storefront-lens-system`) | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/019-storefront-lens-system/spec.md`

## Summary

Mục tiêu: phá vỡ sự cứng nhắc của storefront sinh ra giữa các project bằng cách signal-first → variant-by-rules-and-AI-rank → seed-pick. Mỗi project nhận một vibe descriptor độc nhất (free-text + 1-2 anchor) và một composition gồm các block lấy từ một block library có eligibility/composition rules. Trạng thái thiết kế được persist trong `DESIGN.md` + `blocks.json` đặt cùng workspace project, có lifecycle 5 intent (`init`, `update_token`, `update_no_design`, `redesign`, `shake_design`), validator đầy đủ và migration lazy cho project cũ.

Cách tiếp cận: thêm module `design/` mới bên dưới `src/features/ai-agent/`, bổ sung asset YAML (`block-library`, `categories`, `vibe-reference-pool`) trong `templates/storefront/`, mở rộng `planning/` với `taxonomy-enrichment`, và bump skill `storefront-design` 1.0.0 → 2.0.0. Service hiện có `design-generation-service.server.ts` ở `code-tools/services/` được tái dùng làm entry point cho intent routing và gọi sang module `design/` mới để compose + rank.

## Technical Context

**Language/Version**: TypeScript 6, Node.js 22+ (TanStack Start runtime).
**Primary Dependencies**: `openai` (LLM client + structured output / tool use), `zod` (manifest + library schemas), YAML loader (NEEDS CLARIFICATION nếu repo chưa có loader sẵn — Phase 0 R-001).
**Storage**: Filesystem per-project workspace (`projects/<projectId>/DESIGN.md`, `projects/<projectId>/blocks.json`); template assets dưới `templates/storefront/*.yaml`; không thay đổi DB schema ở phase này.
**Testing**: vitest (đã cấu hình), test colocated trong `__tests__/` cùng module.
**Target Platform**: Node server runtime (TanStack Start server functions).
**Project Type**: web application (server function + assets), monorepo style với `src/features/ai-agent/` cô lập feature này.
**Performance Goals**: Variant ranker chấp nhận 1-2s/call; toàn bộ pipeline `init` ≤ ~30s (bao gồm DESIGN.md tokens). Mỗi project chỉ chạy ranker cho block high-impact (Hero + Feature band + category-specific) ≤ 5 block.
**Constraints**:
- Tái lập (deterministic) cho cùng `(projectId, designVersion, shakeRevision)`.
- Atomic write giữa `DESIGN.md` và `blocks.json` để tránh trạng thái lệch (TR-001).
- Không leak token cụ thể từ template tham chiếu (đã có validator).
- Không sửa repository-level/Builder `.env`/secret.
**Scale/Scope**: ~20 primary categories × ~80-120 subcategories; block library ban đầu ~12-15 block × 3-6 variant; reference pool ~30-50 ví dụ.

## Constitution Check

Đối chiếu với `.specify/memory/constitution.md` v1.4.1:

| Principle | Trạng thái | Ghi chú |
|---|---|---|
| I. Yêu cầu rõ ràng code flow & tính năng | PASS | Phân tách UI client (không thuộc scope) → server function `design/` → repository (filesystem manifest) đã rõ. |
| II. Test cho mọi business rule quan trọng | PASS | Unit test cho composer + ranker + validator + lazy migration; integration test cho 5 intent. Chi tiết cụ thể nằm trong /speckit-tasks. |
| III. API trả lỗi nhất quán | PASS | Failure mode trả về error code chuẩn (taxonomy/vibe-fail, composition-fail, manifest-corrupt, leak-fail), reuse pattern hiện có ở `design-error-codes.ts`. |
| IV. Không over-engineer | PASS | Tái dùng `design-generation-service.server.ts` làm entry; chỉ thêm module `design/` khi có nhánh thật sự khác (compose, rank, validate cross-file). |
| V. UX & Design System | N/A | Feature là backend pipeline; không tạo UI mới ở phase này. |
| VI. Bảo mật role/permission | PASS | Chỉ ghi vào workspace của project (đã có guard hiện hữu); không đụng repo `.env`. |
| VII. Code Review ưu tiên Graph | PASS | Trước commit cuối, review qua `code-graph-review` để đánh giá liên kết planning → design → code-tools/services. |
| VIII. Code Formatting | PASS | Sẽ chạy ESLint/format trước commit. |
| IX. Database JSON | N/A | Không động DB phase này; nếu sau quyết định lưu telemetry vào DB sẽ tuân `json` (không `jsonb`). |
| X. Import Alias | PASS | Sử dụng `@/features/ai-agent/...`, `@/server/...`, không dùng `../`. |

Không có vi phạm cần justify; bảng Complexity Tracking để trống.

## Project Structure

### Documentation (this feature)

```text
specs/019-storefront-lens-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── block-library.schema.yaml
│   ├── design-manifest.schema.json
│   ├── categories.schema.yaml
│   ├── vibe-reference-pool.schema.yaml
│   ├── design-intent.contract.md
│   ├── variant-ranker.prompt.md
│   └── design-generated.event.md
├── grilling-decisions.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

Cấu trúc đề xuất bám sát quyết định D14 trong `grilling-decisions.md`, đồng thời tái dùng những gì đã có dưới `src/features/ai-agent/code-tools/services/design-*`:

```text
src/features/ai-agent/
├── planning/
│   ├── classify-intent.server.ts                    # existing — mở rộng để map 5 intent (D10)
│   ├── design-intent-heuristic.ts                   # existing
│   ├── extract-website-spec.server.ts               # existing
│   ├── taxonomy-enrichment.server.ts                # NEW — primary + subcategory (D24)
│   └── __tests__/
├── design/                                          # NEW module
│   ├── design-pipeline.server.ts                    # entry: route intent → compose/rank/validate/persist
│   ├── block-composer.server.ts                     # apply composition rules (D5, D6, D25)
│   ├── variant-ranker.server.ts                     # AI rank top-3 + seed tiebreak (D6, D23, TR-013, TR-014, TR-015)
│   ├── vibe-author.server.ts                        # descriptor + anchors (D8, D9a, D9b)
│   ├── design-validator.server.ts                   # full validation (D13, FR-015)
│   ├── blocks-manifest.ts                           # zod schema + load/save (D11, TR-001)
│   ├── lazy-migration.server.ts                     # detect missing manifest + infer (D18, TR-007, TR-008, TR-009)
│   ├── seed.ts                                      # hash(projectId, designVersion, shakeRevision[, blockId])
│   ├── telemetry.ts                                 # design_generated event emission (D19)
│   └── __tests__/
└── code-tools/services/
    ├── design-generation-service.server.ts          # existing — bổ sung shake_design + delegate sang design/
    ├── design-template-leak-validator.server.ts     # existing
    ├── design-file-validator.server.ts              # existing — thêm cross-file check Section 1 ↔ manifest
    ├── design-error-codes.ts                        # existing — thêm code mới (composition-fail, anchor-mismatch, …)
    └── …                                            # các service khác giữ nguyên

templates/storefront/
├── block-library.yaml                               # NEW — D4, D5
├── categories.yaml                                  # NEW — D24, TR-016
├── vibe-reference-pool.yaml                         # NEW — D9b, D16
└── (existing template projects)

.agents/skills/storefront-design/
└── SKILL.md                                         # bump 1.0.0 → 2.0.0; cập nhật compatibility (FR-020, D20, TR-012)
```

**Structure Decision**: Giữ nguyên kiến trúc feature-folder dưới `src/features/ai-agent/`. Thêm module `design/` ngang hàng với `planning/` để cô lập logic compose + rank + validate + migrate. `design-generation-service.server.ts` (đã có) đóng vai trò orchestrator/entry để routing intent và uỷ thác xuống `design/design-pipeline.server.ts`. Asset YAML sống cùng `templates/storefront/` để tách dữ liệu khỏi code và dễ review độc lập (TR-004 quarterly cadence). Skill artifact ở `.agents/skills/storefront-design/SKILL.md` được edit tại chỗ + bump version.

## Complexity Tracking

> Không có vi phạm constitution cần justify ở phase này.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | —          | —                                   |
