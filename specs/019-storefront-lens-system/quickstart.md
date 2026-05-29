# Quickstart — Storefront Lens System

**Date**: 2026-05-29
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md)

Mục đích: cách kiểm tra nhanh pipeline mới sau khi implement, bao gồm bootstrap asset, chạy 5 intent trên một project sandbox, và xác nhận telemetry/manifest đúng.

---

## 0. Tiền điều kiện

- Repo đã có `pnpm install`.
- Node 22+, TypeScript build sạch (`pnpm typecheck`).
- LLM provider key (OpenAI) trong `.env` đã có (đang dùng cho `agent` runtime).
- Một project sandbox dưới `projects/<projectId>/` (có thể tạo qua flow init hiện hành hoặc copy template `templates/storefront/basic-ecommerce/`).

## 1. Bootstrap asset YAML (mới)

```bash
ls templates/storefront/
# expected mới: block-library.yaml  categories.yaml  vibe-reference-pool.yaml

# validate parse
pnpm tsx scripts/validate-storefront-assets.ts   # script sẽ được thêm khi implement
```

Asset bắt buộc tồn tại trước khi pipeline chạy. Schema:

- `templates/storefront/block-library.yaml` — xem `contracts/block-library.schema.yaml`.
- `templates/storefront/categories.yaml` — xem `contracts/categories.schema.yaml`.
- `templates/storefront/vibe-reference-pool.yaml` — xem `contracts/vibe-reference-pool.schema.yaml`.

Nếu loader fail tại boot → kiểm tra log, thường do reference giữa các YAML không khớp (ví dụ block tham chiếu anchor không tồn tại).

## 2. Bump skill artifact

```bash
grep -rn "1\.0\.0" .agents/skills/storefront-design     # chỉ FE-INTENT bump (TR-012)
```

Cập nhật `.agents/skills/storefront-design/SKILL.md`:
- frontmatter `version: 2.0.0`
- compatibility line: `Cloud-AI builder pipeline (design-pipeline.server.ts via design-generation-service.server.ts)`

## 3. Chạy 5 intent trên project sandbox

Bước này dùng integration test runner (vitest) để khỏi cần UI:

```bash
pnpm vitest run src/features/ai-agent/design/__tests__/design-pipeline.intent.test.ts
```

Test gồm 5 case:

1. **`init`**: project trống → tạo `DESIGN.md` + `blocks.json`. Kỳ vọng:
   - `blocks.json` parse được, `manifestVersion = 1`, `designVersion = 1`, `shakeRevision = 0`.
   - `composition[]` chứa Header/Hero/Product grid/Footer + ≥ 1 block social-proof.
   - Section 1 có 3 bullet `Descriptor:` / `Anchors:` / `Story:`; anchors khớp `manifest.vibe.anchors`.
   - 1 event `design_generated` với intent `init`.

2. **`update_token`**: patch màu primary → `DESIGN.md` Section 2 đổi giá trị; `blocks.json` giữ nguyên `composition`/`vibe`/`seed`/`designVersion`/`shakeRevision`. 0 event `design_generated`.

3. **`update_no_design`**: 0 file thay đổi, 0 event.

4. **`redesign`**: `designVersion` tăng 1, `shakeRevision = 0`, seed mới, vibe mới, composition mới. 1 event.

5. **`shake_design`**: `designVersion` giữ nguyên, `shakeRevision += 1`, vibe + tokens + `composition[].blockId/position` giữ nguyên, `composition[].variantId` đổi cho **mọi** entry. 1 event.

## 4. Determinism check

```bash
pnpm vitest run src/features/ai-agent/design/__tests__/design-pipeline.determinism.test.ts
```

Chạy `init` 3 lần với cùng `(projectId, signal, designVersion=1, shakeRevision=0)` → 3 manifest identical (sau khi normalize `generatedAt`).

## 5. Variance smoke test

```bash
pnpm vitest run src/features/ai-agent/design/__tests__/design-pipeline.variance.test.ts
```

Sinh 20 project khác `(primaryCategory, subcategory)`:
- `vibe.descriptor` distinct count == 20 (cardinality cao, SC-003).
- Top variant trên `Hero` không vượt 25% share (proxy cho SC-001).
- Mọi project có Tier 1 đầy đủ (SC-002).

## 6. Migration check

Chuẩn bị fixture project chỉ có `DESIGN.md` (legacy), không có `blocks.json`:

```bash
pnpm vitest run src/features/ai-agent/design/__tests__/lazy-migration.test.ts
```

Kỳ vọng:
- Sau intent kế tiếp (vd `update_token` hoặc `redesign`), `blocks.json` được tạo.
- Section 1 bullet structure được viết lại; anchor lấy từ legacy vibe label theo TR-008.
- Khi vibe-author throw, fallback descriptor `<old-label> sensibility, refined` được dùng (TR-009).

## 7. Telemetry sanity

```bash
pnpm vitest run src/features/ai-agent/design/__tests__/telemetry.test.ts
```

Kỳ vọng:
- Schema parse pass cho event của `init`/`redesign`/`shake_design`.
- `update_token` và `update_no_design` không emit.
- Sink fail không làm pipeline fail.

## 8. Manual smoke (UI free)

Nếu cần kiểm thử end-to-end qua server function:

```bash
pnpm dev
# Trong client/admin, tạo project mới + nhập prompt; theo dõi logs:
tail -f logs/server.log | grep design_generated
```

Kiểm tra `projects/<projectId>/blocks.json`:
- `seed` là 64 hex chars.
- `composition[].position` tăng dần.
- `vibe.anchors[]` có 1-2 phần tử.

## 9. Rollback

Vì asset YAML mới và module `design/` là addition, rollback là revert commit. Lưu ý: nếu đã có project tạo `blocks.json`, rollback sẽ làm `design-generation-service.server.ts` cũ bỏ qua manifest. Đã đáp ứng forward-compat: file dư không gây lỗi.

---

## Troubleshooting nhanh

| Triệu chứng | Nguyên nhân khả dĩ | Hành động |
|---|---|---|
| Pipeline throw `manifest-corrupt` | `blocks.json` được edit thủ công sai schema | Xoá file + chạy lại intent (sẽ tạo qua migration path) |
| `composition-fail` lặp lại | Block library có rule mâu thuẫn | Validate `block-library.yaml` qua `loadBlockLibrary` test |
| Variant pick toàn rơi vào 1 lựa chọn | Reference pool ít coverage cho category đó | Bổ sung example trong `vibe-reference-pool.yaml` (TR-004 quarterly review) |
| Section 1 anchor ≠ manifest anchor | Vibe-author bị retry và lệch | Validator sẽ chặn persist; check log `cross-file-fail` |
| Event `design_generated` không xuất hiện | Sink không lên (R-006 logger fallback) | Kiểm tra logger channel; emit hiện chỉ console JSON |
