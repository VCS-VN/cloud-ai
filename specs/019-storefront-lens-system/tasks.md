---

description: "Tasks for Storefront Lens System (019) — dependency-ordered, organized by user story"
---

# Tasks: Storefront Lens System (Design Variance)

**Input**: Design documents from `/specs/019-storefront-lens-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests INCLUDED. Lý do: Constitution Principle II yêu cầu test cho mọi business rule quan trọng; spec FR-014 (deterministic), FR-015 (full validation), FR-016 (failure modes), SC-001..SC-007 đều cần test để verify.

**Organization**: Theo user story (P1 → P3). Mỗi story độc lập kiểm thử được sau khi Phase 1 + Phase 2 xong.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (file khác nhau, không phụ thuộc task chưa xong).
- **[Story]**: US1 / US2 / US3 / US4 — bám theo `spec.md`.
- File path tuyệt đối tương đối repo root.

## Path Conventions

- Source code: `src/features/ai-agent/...`
- Static assets: `templates/storefront/*.yaml`
- Skill artifact: `.agents/skills/storefront-design/SKILL.md`
- Tests: colocated trong `__tests__/` cùng module (theo convention repo).
- Spec contracts (read-only reference): `specs/019-storefront-lens-system/contracts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo module, dependency, và scaffolding chung cho toàn feature.

- [X] T001 Tạo thư mục module `src/features/ai-agent/design/` (file `.gitkeep` tạm) và thư mục test `src/features/ai-agent/design/__tests__/` per `plan.md` Project Structure.
- [X] T002 Thêm dependency `js-yaml` (^4.x) và `@types/js-yaml` vào `package.json` rồi `pnpm install`. Lý do: R-001 trong `research.md`.
- [X] T003 [P] Verify TypeScript baseline pass (`pnpm typecheck`) sau khi thêm dep và scaffolding rỗng.
- [X] T004 [P] Tạo file rỗng `templates/storefront/block-library.yaml`, `templates/storefront/categories.yaml`, `templates/storefront/vibe-reference-pool.yaml` với top-level `version: 1` để pipeline boot không throw trước khi nội dung được fill ở phase sau.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, loader, asset content, seed/atomic-write, error codes — mọi user story đều phụ thuộc.

**⚠️ CRITICAL**: Không bắt đầu Phase 3+ trước khi Phase 2 xong.

### Schemas (zod) — single source of truth

- [X] T005 [P] Implement `BlockLibrarySchema` (zod) trong `src/features/ai-agent/design/blocks-manifest.ts`, khớp `specs/019-storefront-lens-system/contracts/block-library.schema.yaml`. Export type `BlockLibrary`.
- [X] T006 [P] Implement `CategoryTaxonomySchema` (zod) trong `src/features/ai-agent/design/blocks-manifest.ts`, khớp `specs/019-storefront-lens-system/contracts/categories.schema.yaml`. Export type `CategoryTaxonomy`.
- [X] T007 [P] Implement `VibeReferencePoolSchema` (zod) trong `src/features/ai-agent/design/blocks-manifest.ts`, khớp `specs/019-storefront-lens-system/contracts/vibe-reference-pool.schema.yaml`. Export types `Anchor`, `ReferencePoolEntry`.
- [X] T008 Implement `BlocksManifestSchema` (zod) trong `src/features/ai-agent/design/blocks-manifest.ts`, khớp `specs/019-storefront-lens-system/contracts/design-manifest.schema.json`. Export type `DesignManifest`. Phụ thuộc T005-T007 để có sẵn type chia sẻ (Vibe, anchor list).
- [X] T009 Implement `DesignGeneratedEventSchema` (zod) trong `src/features/ai-agent/design/telemetry.ts` khớp `specs/019-storefront-lens-system/contracts/design-generated.event.md`. Export `emitDesignGenerated(event)` (R-006: log JSON line, không throw).

### Asset content (YAML) — fill nội dung tối thiểu

- [X] T010 Soạn `templates/storefront/categories.yaml`: ~20 primary × tổng ~80-120 subcategory đúng schema T006. Đảm bảo cross-asset checks pass.
- [X] T011 [P] Soạn `templates/storefront/vibe-reference-pool.yaml`: ~12 anchor (mỗi anchor có `legacyLabels` để di trú) + ~30-50 example đúng schema T007. Mỗi anchor có ít nhất 1 example.
- [X] T012 Soạn `templates/storefront/block-library.yaml`: ~12-15 block (Tier 1: header, hero, product-grid, footer; group social-proof: trust-signals, press-features, founder-note, material-sourcing; optional: category-strip, feature-band, newsletter, …). Mỗi block 3-6 variant với `vibeAffinity` tham chiếu anchors trong T011. Cross-asset reference với T010 (`applicableCategories`). Phụ thuộc T010, T011.

### Loader + utility chung

- [X] T013 Implement `library-loader.server.ts` trong `src/features/ai-agent/design/`: load + parse + zod-validate ba YAML, cache process-level, throw fast khi cross-asset reference fail (R-001). Export `loadBlockLibrary()`, `loadCategoryTaxonomy()`, `loadReferencePool()`.
- [X] T014 [P] Implement `seed.ts` trong `src/features/ai-agent/design/`: `computeSeed(projectId, designVersion, shakeRevision)` và `computeBlockSeed(seed, blockId)` dùng sha256 (R-005). Pure utility — no I/O.
- [X] T015 [P] Implement helper `atomic-write.ts` (hoặc thêm vào `blocks-manifest.ts`) cho pattern write-temp-then-rename — dùng cho `blocks.json` và `DESIGN.md` (R-003 / TR-001). Không phụ thuộc module khác.
- [X] T016 [P] Mở rộng `src/features/ai-agent/code-tools/services/design-error-codes.ts`: thêm code `composition-fail`, `affinity-fail`, `cross-file-fail`, `manifest-corrupt`, `taxonomy-soft-miss`, `anchor-mismatch`. Export `ManualReviewReason` union (D17 + design-intent contract).

### Foundational tests

- [X] T017 [P] Test `src/features/ai-agent/design/__tests__/blocks-manifest.schema.test.ts`: parse valid manifest fixture PASS; parse manifest thiếu `seed` FAIL; high-impact entry không có `rankRationale` FAIL (T008).
- [X] T018 [P] Test `src/features/ai-agent/design/__tests__/library-loader.test.ts`: load 3 YAML thật PASS; mock YAML thiếu `requirementGroup` cho `requirementLevel: group` → FAIL; reference anchor không tồn tại → FAIL (T013).
- [X] T019 [P] Test `src/features/ai-agent/design/__tests__/seed.test.ts`: cùng input → cùng seed; đổi `shakeRevision` → seed khác; `computeBlockSeed` deterministic và phụ thuộc blockId (T014).
- [X] T020 [P] Test `src/features/ai-agent/design/__tests__/atomic-write.test.ts`: file không xuất hiện trong trạng thái half-written; rename atomic giữa hai lần write (T015).

**Checkpoint**: Foundation ready — schemas + asset + loader + seed + atomic-write + error codes + smoke tests đều xanh.

---

## Phase 3: User Story 1 — Sinh thiết kế storefront độc nhất khi khởi tạo project (P1) 🎯 MVP

**Goal**: Khi project mới `init`, sinh `DESIGN.md` (Section 1 strict bullet) + `blocks.json` (manifest) đúng cấu trúc, đầy đủ Tier 1 + ít nhất 1 block social-proof, vibe descriptor độc nhất, deterministic theo seed.

**Independent Test**: Init nhiều project khác category → mỗi project có vibe descriptor khác nhau, composition khác nhau, variant khác nhau, đủ Tier 1 + group, manifest hợp lệ. Cùng input + designVersion=1 + shakeRevision=0 chạy 3 lần → manifest identical (sau normalize timestamp).

### Tests for User Story 1 (Write FIRST, ensure FAIL before implementation)

- [X] T021 [P] [US1] Contract test `src/features/ai-agent/design/__tests__/design-pipeline.init.test.ts`: chạy `runDesignPipeline({ intent: "init", ... })` trên project sandbox tạm; assert acceptance scenario US1 #1 (`DESIGN.md` Section 1 bullet `Descriptor:`/`Anchors:`/`Story:`; `blocks.json` có `designVersion=1`, `shakeRevision=0`, `seed`, `vibe`, `composition`).
- [X] T022 [P] [US1] Test US1 #2: vibe có descriptor free-text + 1-2 anchor từ bounded list (anchors ⊆ anchors.yaml).
- [X] T023 [P] [US1] Test US1 #3 + FR-007: composition có đủ Tier 1 (header, hero, product-grid, footer) + ít nhất 1 block requirementGroup `social-proof`. Assert mỗi block Tier 1 có `position == block.defaultPosition` (FR-007).
- [X] T024 [P] [US1] Test US1 #4 (FR-014 deterministic): chạy `init` 3 lần với cùng `(projectId, designVersion=1, shakeRevision=0, signal)` → 3 manifest identical (loại `generatedAt`).
- [X] T025 [P] [US1] Test FR-015 cross-file: anchors trong DESIGN.md Section 1 == `manifest.vibe.anchors` (1-1).
- [X] T026 [P] [US1] Test variance smoke (proxy SC-001/SC-003): sinh 20 project khác `(primaryCategory, subcategory)` → `vibe.descriptor` distinct count = 20; top variant của `hero` không vượt 25% share.

### Implementation for User Story 1

- [X] T027 [P] [US1] Implement `taxonomy-enrichment.server.ts` trong `src/features/ai-agent/planning/`: input WebsiteSpec + prompt → `{ primaryCategoryId, subcategoryId|null, archetype|null, priceTier|null }`. Dùng `loadCategoryTaxonomy` (T013); subcategory không match → return `null` + emit log (R-009 / TR-017).
- [X] T028 [US1] Implement `vibe-author.server.ts` trong `src/features/ai-agent/design/`: input enriched signal + reference pool few-shot → `Vibe { descriptor, anchors[1-2], story }`. LLM call (`openai`); structured output theo zod schema; 1-retry trên invalid output. Phụ thuộc T013 (loader).
- [X] T029 [US1] Implement `block-composer.server.ts` trong `src/features/ai-agent/design/`: input enriched signal + vibe → list block thoả `compositionRules` + Tier 1 + group at-least-one + AI quyết optional. Phụ thuộc T013, T028, T016. Trả `CompositionEntry[]` chưa có `variantId`.
- [X] T030 [US1] Implement `variant-ranker.server.ts` trong `src/features/ai-agent/design/`: theo `specs/019-storefront-lens-system/contracts/variant-ranker.prompt.md`. Chia static prefix (cacheable) vs dynamic suffix; structured output (json_schema); fallback heuristic khi schema fail. Phụ thuộc T014 (`computeBlockSeed`).
- [X] T031 [US1] Implement variant pick logic trong `block-composer.server.ts` (hoặc helper riêng): tier `high-impact` → gọi T030 + seed-tiebreak; tier `supporting` → code-filter theo eligibility + seed-pick thuần. Phụ thuộc T030.
- [X] T032 [US1] Implement `design-validator.server.ts` trong `src/features/ai-agent/design/`: structural (manifest schema), composition rules (mustPrecede/mustFollow/mutuallyExclusive/maxOccurrences/required tier-1/group), cross-file (anchors Section 1 ↔ manifest.vibe.anchors), vibe-variant affinity (variant chosen có ít nhất 1 anchor trùng vibe.anchors với score ≥ 0.5). Phụ thuộc T005, T008, T016.
- [X] T033 [US1] Implement `design-pipeline.server.ts` trong `src/features/ai-agent/design/`: entry `runDesignPipeline(input)` xử lý intent `init`: enrichment → vibe-author → block-composer → variant pick → DESIGN.md compose (reuse pipeline DESIGN.md sections 2-8 hiện có) → validator → atomic write (manifest → DESIGN.md theo R-003) → emit telemetry. Phụ thuộc T027-T032, T009, T015. Trả `DesignPipelineResult`.
- [X] T034 [US1] Wire `runDesignPipeline` vào `src/features/ai-agent/code-tools/services/design-generation-service.server.ts`: route intent `init` sang pipeline mới; giữ behavior cũ ẩn sau feature gate hay thay thế hoàn toàn theo plan (FR-013). Phụ thuộc T033.
- [X] T035 [US1] Update `src/features/ai-agent/code-tools/services/design-file-validator.server.ts`: thêm cross-file check Section 1 anchors ↔ `blocks.json` (FR-015). Phụ thuộc T013, T008.
- [X] T036 [US1] Implement telemetry emit point trong T033 cho intent `init`: build `DesignGeneratedEvent`, parse qua T009 schema, fail gracefully khi sink fail.

**Checkpoint**: User Story 1 hoạt động end-to-end. Test T021-T026 xanh. MVP có thể demo: tạo nhiều project khác category → khác composition + vibe + variant.

---

## Phase 4: User Story 2 — Lắc lại thiết kế và làm lại toàn bộ (P2)

**Goal**: Hỗ trợ 4 intent còn lại (`shake_design`, `redesign`, `update_token`, `update_no_design`) với invariants ở `data-model.md` mục "State transitions".

**Independent Test**: Trên project đã `init`, chạy `shake_design` → variant đổi cho mọi block, vibe + token + block list giữ nguyên; `redesign` → designVersion tăng, vibe/composition mới; `update_token` → chỉ token DESIGN.md đổi, manifest content giữ; `update_no_design` → no-op.

### Tests for User Story 2

- [X] T037 [P] [US2] Test `src/features/ai-agent/design/__tests__/design-pipeline.shake.test.ts`: sau `shake_design`, `shakeRevision = old + 1`, `composition[].variantId` đổi cho TẤT CẢ entry, `composition[].blockId/position` giữ nguyên, `vibe` giữ nguyên (US2 #1, FR-013).
- [X] T038 [P] [US2] Test `src/features/ai-agent/design/__tests__/design-pipeline.redesign.test.ts`: sau `redesign`, `designVersion = old + 1`, `shakeRevision = 0`, seed mới, vibe + composition mới (US2 #2).
- [X] T039 [P] [US2] Test `src/features/ai-agent/design/__tests__/design-pipeline.update-token.test.ts`: sau `update_token`, manifest `designVersion`/`shakeRevision`/`composition`/`vibe`/`seed` giữ nguyên; `lastIntent = "update_token"`; DESIGN.md sections 2-8 đổi giá trị token; 0 event `design_generated` (US2 #3, contract `design-intent`).
- [X] T040 [P] [US2] Test `src/features/ai-agent/design/__tests__/design-pipeline.update-no-design.test.ts`: sau `update_no_design`, không file thay đổi, không event (US2 #4).
- [X] T041 [P] [US2] Test failure mode 3 (composition fail): inject composer trả composition vi phạm `mustPrecede` → result `needs-manual-review`, không file ghi xuống workspace (FR-016, contract).
- [X] T042 [P] [US2] Test failure mode 5 (cross-file fail): inject vibe-author trả anchors lệch giữa Section 1 ↔ manifest → `needs-manual-review`, không persist.
- [X] T042a [P] [US2] Test failure mode 1 (taxonomy-fail): mock taxonomy lookup throw → 1 retry → heuristic fallback (lookup table category → defaultAnchor) kicks in; pipeline succeed với manifest hợp lệ; emit telemetry vẫn fire (FR-016, TR-006).
- [X] T042b [P] [US2] Test failure mode 2 (vibe-fail): mock vibe-author trả output sai zod schema → 1 retry → heuristic fallback (category → defaultAnchor + descriptor "<category-default> sensibility") kicks in; pipeline succeed (FR-016).
- [X] T042c [P] [US2] Test failure mode 4 (affinity-fail): mock variant-ranker trả variant có `vibeAffinity[anchor] < 0.5` cho mọi anchor trong vibe → 1 retry → mark `needs-manual-review`, KHÔNG persist file (FR-016, SC-007).
- [X] T042d [P] [US2] Test failure mode 6 (manifest-corrupt): seed `blocks.json` với JSON syntax invalid → 1 retry read → throw error code `manifest-corrupt`; pipeline KHÔNG ghi đè file corrupt (FR-016).
- [X] T042e [P] [US2] Test failure mode 7 (leak-fail): mock token output trùng giá trị `templates/storefront/basic-ecommerce/DESIGN.md` (template token leak) → 1 retry → heuristic fallback persist; nếu retry vẫn leak → mark `needs-manual-review`, KHÔNG persist (FR-016, reuse `design-template-leak-validator`).

### Implementation for User Story 2

- [X] T043 [US2] Mở rộng `src/features/ai-agent/planning/classify-intent.server.ts`: classify 5 intent (`init`, `update_token`, `update_no_design`, `redesign`, `shake_design`) (D10). Phụ thuộc tests T037-T040 đã thiết lập kỳ vọng.
- [X] T044 [US2] Mở rộng `design-pipeline.server.ts` (T033) xử lý intent `redesign`: bump `designVersion`, reset `shakeRevision = 0`, recompute seed, gọi lại vibe-author + composer + ranker giống `init`. Reuse code path từ T033.
- [X] T045 [US2] Mở rộng `design-pipeline.server.ts` xử lý intent `shake_design`: load manifest hiện tại, bump `shakeRevision`, recompute seed, giữ `vibe` + `composition[].blockId/position`, re-pick `variantId` cho mọi entry (high-impact re-rank, supporting code-pick); regen DESIGN.md component-styling section nếu cần (Section 6). Phụ thuộc T030, T031.
- [X] T046 [US2] Mở rộng `design-pipeline.server.ts` xử lý intent `update_token`: forward `tokenPatch` cho `design-rule-patch-service` hiện có; manifest chỉ cập nhật `lastIntent` + `generatedAt`; atomic write cả hai file. Không emit `design_generated`.
- [X] T047 [US2] Mở rộng `design-pipeline.server.ts` xử lý intent `update_no_design`: short-circuit return `{ status: "no-op" }`, không I/O, không event.
- [X] T048 [US2] Implement failure-mode handling trong `design-pipeline.server.ts` cho TẤT CẢ 7 mode (FR-016): mode 1 (taxonomy-fail) + mode 2 (vibe-fail) → 1-retry → heuristic fallback (T049 lookup table); mode 3 (composition-fail) + mode 4 (affinity-fail) + mode 5 (cross-file-fail) + mode 7 (leak-fail) → 1-retry → mark `needs-manual-review` KHÔNG persist; mode 6 (manifest-corrupt) → 1-retry read → throw. Mọi nhánh fallback đảm bảo cross-file consistency trước khi persist. Phụ thuộc T016, T032, T049. Verify qua T041/T042/T042a-e.
- [X] T049 [US2] Implement heuristic fallback table trong `src/features/ai-agent/design/heuristic-fallback.ts`: map `category → defaultAnchor` (TR-006); map block → default variant index 0 (TR-002). Curated từ T010/T011.
- [X] T050 [US2] Wire 4 intent mới vào `src/features/ai-agent/code-tools/services/design-generation-service.server.ts` (đã có hook ở T034). Phụ thuộc T044-T047.

**Checkpoint**: User Story 2 hoàn chỉnh. Test T037-T042 xanh. Hai user story có thể demo cùng nhau: init → shake → redesign → update_token → update_no_design.

---

## Phase 5: User Story 3 — Di trú project cũ chưa có manifest (P3)

**Goal**: Project cũ chỉ có `DESIGN.md` được lazy-migrate ở intent kế tiếp: tạo `blocks.json` từ default rhythm + Section 1 viết lại với anchor lấy từ legacy vibe label; có fallback descriptor khi vibe-author throw.

**Independent Test**: Fixture project chỉ có `DESIGN.md` cũ → chạy bất kỳ intent nào → `blocks.json` hợp lệ được tạo + Section 1 đúng bullet structure. Trường hợp vibe-author fail, descriptor = `<old-label> sensibility, refined`.

### Tests for User Story 3

- [X] T051 [P] [US3] Test `src/features/ai-agent/design/__tests__/lazy-migration.success.test.ts`: fixture chỉ có `DESIGN.md` cũ (vibe label `minimalist`) → chạy `update_token` → `blocks.json` được tạo, anchors=[`minimalist`] (qua TR-008 mapping), composition lấy default rhythm (Header → Hero → Category → Product grid → Feature band → Trust signals → Newsletter → Footer), variant index 0 mỗi block, Section 1 bullet structure (US3 #1).
- [X] T052 [P] [US3] Test `src/features/ai-agent/design/__tests__/lazy-migration.fallback.test.ts`: vibe-author mocked throw → descriptor fallback `"minimalist sensibility, refined"`, anchor `["minimalist"]`. Assert thêm: `blocks.json` được persist với composition default rhythm; `DESIGN.md` Section 1 được rewrite đúng bullet structure; cross-file anchor consistency PASS (US3 #2, TR-009, FR-018).
- [X] T053 [P] [US3] Test `update_no_design` cũng kích hoạt migration (lazy detect ở entry, R-007).

### Implementation for User Story 3

- [X] T054 [P] [US3] Implement `lazy-migration.server.ts` trong `src/features/ai-agent/design/`: `lazyMigrateIfNeeded(workspacePath, projectId)`: nếu `blocks.json` đã có → return; nếu không → đọc DESIGN.md, parse legacy vibe label, gọi T011 anchor `legacyLabels` lookup, build manifest từ default rhythm (T012 + index 0), call vibe-author để rewrite Section 1 (anchor cố định = legacy mapping). Atomic write hai file. Phụ thuộc T013, T015, T028, T032.
- [X] T055 [US3] Implement fallback descriptor trong `lazy-migration.server.ts`: bắt vibe-author throw → descriptor = `<old-label> sensibility, refined`, anchor = legacy mapping (TR-009). Phụ thuộc T054.
- [X] T056 [US3] Wire `lazyMigrateIfNeeded` vào entry của `design-pipeline.server.ts` (T033 / T044-T047): gọi trước khi route intent, áp dụng cho mọi intent kể cả `update_no_design` (R-007). Phụ thuộc T054.

**Checkpoint**: User Story 3 hoàn chỉnh. Test T051-T053 xanh. Project cũ rollout an toàn.

---

## Phase 6: User Story 4 — Theo dõi độ đa dạng qua telemetry (P3)

**Goal**: Mỗi lần sinh thiết kế thành công phát event `design_generated` đủ field; sink không block pipeline.

**Independent Test**: Sinh thiết kế nhiều project → mỗi lần (intent `init`/`redesign`/`shake_design`) có 1 event đúng schema; intent `update_token`/`update_no_design` không phát event; sink throw không làm pipeline fail.

### Tests for User Story 4

- [X] T057 [P] [US4] Test `src/features/ai-agent/design/__tests__/telemetry.test.ts`: mỗi intent `init`/`redesign`/`shake_design` thành công → 1 event với schema parse PASS, đủ fields.
- [X] T058 [P] [US4] Test telemetry không emit cho `update_token` và `update_no_design` (US4 contract).
- [X] T059 [P] [US4] Test sink throw không break pipeline: mock `emitDesignGenerated` throw → pipeline vẫn return `ok`, manifest persist thành công.

### Implementation for User Story 4

- [X] T060 [US4] Hoàn thiện `src/features/ai-agent/design/telemetry.ts` (đã scaffold ở T009): wrap emit trong `try/catch` log warn; bảo đảm caller không bị throw lan ra.
- [X] T061 [US4] Đảm bảo emit point trong `design-pipeline.server.ts` được gọi cho 3 intent (init/redesign/shake_design) với payload đúng (T036 đã có cho init; thêm cho redesign + shake trong T044, T045 — verify lại). Phụ thuộc T036, T044, T045.

**Checkpoint**: Telemetry contract hoàn chỉnh. Test T057-T059 xanh.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Skill artifact bump, validation script, documentation, lint/format, code-graph review.

- [X] T062 [P] Edit `.agents/skills/storefront-design/SKILL.md`: bump frontmatter `version: 1.0.0` → `2.0.0`, cập nhật `compatibility` line trỏ tới `design-pipeline.server.ts`, thêm mục mới mô tả contract giữa skill (Section 1 strict bullet) và pipeline (`blocks.json`). Bám R-010 + FR-020 + D20.
- [X] T063 [P] `grep -rn "1\.0\.0" .agents/skills/storefront-design` (TR-012); update mọi tham chiếu version còn hard-coded ngoài frontmatter.
- [X] T064 [P] Implement script `scripts/validate-storefront-assets.ts` (referenced trong `quickstart.md` step 1): load 3 YAML qua T013 và print PASS/FAIL summary; exit 1 khi fail. Wire vào `pnpm typecheck` hoặc tạo `pnpm validate-assets`.
- [X] T065 [P] Run quickstart validation theo `specs/019-storefront-lens-system/quickstart.md` từng bước (1-9), capture output, fix issue nào còn sót.
- [X] T066 [P] Run `pnpm typecheck` + ESLint format trước commit (Constitution VIII).
- [X] T067 Run `code-graph-review` trên branch (Constitution VII): đánh giá liên kết `planning/` → `design/` → `code-tools/services/`, không có orphan/cycle.
- [X] T068 [P] Test variance baseline (SC-001 proxy): sinh ≥ 50 project trong test variance, assert top-1 cluster của Hero variant không vượt 25% share. (Có thể marked slow — chạy nightly.)
- [X] T069 [P] Cleanup: xoá `.gitkeep` khỏi `design/` nếu module đã có file thật; remove dead imports do `code-tools/services/design-generation-service.server.ts` cũ tạo ra (chỉ những import KHÔNG còn được dùng do thay đổi của feature này, theo AGENTS.md "Surgical Changes").

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: không phụ thuộc — chạy trước.
- **Phase 2 (Foundational)**: phụ thuộc Phase 1; **CHẶN** mọi Phase 3+.
- **Phase 3 (US1 / P1 / MVP)**: phụ thuộc Phase 2.
- **Phase 4 (US2 / P2)**: phụ thuộc Phase 3 (vì 4 intent còn lại tái sử dụng pipeline + atomic write + validator của US1).
- **Phase 5 (US3 / P3)**: phụ thuộc Phase 3 (lazy migration cần `vibe-author`, `validator`, atomic write); độc lập với Phase 4 nhưng nếu Phase 4 đã có `lazyMigrateIfNeeded` ở entry sẽ dễ wire hơn.
- **Phase 6 (US4 / P3)**: phụ thuộc Phase 3 (cho `init`); để verify đủ 3 intent thì cần Phase 4 (`redesign`/`shake_design`).
- **Phase 7 (Polish)**: phụ thuộc tất cả user story đã ổn.

### Within-Story Dependencies (key)

- T005-T007 (zod schemas) trước T008 (manifest schema reuse type), T013 (loader cần schemas).
- T010 + T011 trước T012 (block library reference category & anchor).
- T013 (loader) trước T028 (vibe-author), T029 (composer), T030 (ranker).
- T028 + T029 trước T030 (composer cần biết block list trước rank).
- T030 + T031 trước T033 (pipeline gắn variant pick).
- T032 (validator) trước T033 (pipeline call).
- T033 trước T034 (wire vào service hiện có).
- T034 trước T043 (classify-intent mở rộng dùng pipeline mới làm route target).
- T043 trước T044-T047 (intent dispatch).
- T054 trước T056 (wire vào pipeline entry).
- T036 / T044-T045 trước T061 (verify emit point).
- T048 trước T056 (cùng đụng `design-pipeline.server.ts` entry; tránh merge conflict). Nếu Phase 5 chạy song song Phase 4, đợi T048 land trước khi merge T056.

### Parallel Opportunities

- T003, T004 song song với nhau (T002 phải xong trước).
- T005, T006, T007 song song (cùng file `blocks-manifest.ts` nhưng khác section — nếu sợ conflict, gộp thành một task tuần tự; mặc định để [P] vì bạn có thể split file con).
- T011, T010 song song (khác file YAML).
- T014, T015, T016 song song (khác file).
- T017-T020 chạy song song (foundational test, khác file).
- T021-T026 toàn bộ test US1 chạy song song.
- T037-T042 toàn bộ test US2 chạy song song.
- T051-T053 test US3 song song.
- T057-T059 test US4 song song.
- T062, T063, T064, T065, T066, T068, T069 polish chạy song song (tránh chồng file).
- Sau Phase 2, US1 / US3 có thể được làm song song bởi 2 dev khác nhau (US3 chỉ cần `vibe-author` + `validator` + asset đã sẵn từ Phase 2/3 đầu; nếu thiếu, đợi T028, T032 xong).

---

## Parallel Example: User Story 1

```bash
# Round 1 — viết tests song song:
Task: "T021 Contract test design-pipeline init in __tests__/design-pipeline.init.test.ts"
Task: "T022 Test US1 #2 vibe descriptor + anchors in __tests__/..."
Task: "T023 Test US1 #3 Tier 1 + social-proof in __tests__/..."
Task: "T024 Test deterministic 3-run in __tests__/design-pipeline.determinism.test.ts"
Task: "T025 Test cross-file anchor consistency in __tests__/..."
Task: "T026 Test variance smoke 20 project in __tests__/design-pipeline.variance.test.ts"

# Round 2 — sau T028 (vibe-author) xong, làm composer + ranker song song:
Task: "T029 Implement block-composer.server.ts"
Task: "T030 Implement variant-ranker.server.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup (T001-T004).
2. Phase 2 Foundational (T005-T020) — gate test xanh.
3. Phase 3 US1 (T021-T036) — test `init` xanh.
4. **STOP & VALIDATE**: chạy quickstart bước 3 case `init` + bước 4 (determinism) + bước 5 (variance). Nếu OK, có thể demo hoặc release flag.

### Incremental Delivery

- MVP (US1) → bật flag cho dev/staging.
- Thêm US2 (4 intent còn lại) → release đầy đủ lifecycle.
- Thêm US3 (lazy migration) → bật rollout cho project cũ.
- Thêm US4 (telemetry hoàn chỉnh) → mở metrics cho ops.
- Phase 7 polish trước final merge.

### Parallel Team Strategy

- Dev A: T001-T020 (Setup + Foundational), pair với reviewer cho YAML asset T010-T012.
- Sau Phase 2:
  - Dev A: US1 (T021-T036) — MVP.
  - Dev B: US3 (T051-T056) song song (sau khi T028, T032 sẵn từ Dev A).
  - Dev C: US4 hồi T057-T061 (cần emit point của Dev A trong T033, T044, T045).
- Dev A tiếp tục US2 (T037-T050) sau khi US1 xong.
- Polish (Phase 7) chia theo task [P].

---

## Notes

- [P] tasks = file khác nhau, không phụ thuộc task chưa xong.
- [Story] map task → user story để theo dõi.
- Tests viết trước implementation (TDD); chạy đảm bảo FAIL trước khi code.
- Commit theo logical group (vd "feat(design): T028 vibe-author"), KHÔNG amend; AGENTS.md "Surgical Changes" — đụng tối thiểu file.
- Constitution gates trước merge: I (code flow rõ), II (tests cover), III (error code chuẩn), IV (no over-engineer), VI (không sửa repo `.env`), VII (`code-graph-review` ở T067), VIII (lint/format ở T066), X (alias `@/`).
- Không tạo DB table mới phase này (TR-010 defer).
- Skill bump 1.0.0 → 2.0.0 (T062) là breaking change về output contract — chú ý changelog khi merge.
