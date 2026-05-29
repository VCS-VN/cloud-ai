# Contract: Design Intent Pipeline (5 intents)

**Module**: `src/features/ai-agent/design/design-pipeline.server.ts`
**Caller**: `src/features/ai-agent/code-tools/services/design-generation-service.server.ts` (orchestrator entry).
**Spec FR**: FR-013 (5 intents), FR-014 (deterministic), FR-016 (per-failure-mode).

## Public function

```ts
export type DesignIntent =
  | "init"
  | "update_token"
  | "update_no_design"
  | "redesign"
  | "shake_design";

export type DesignPipelineInput = {
  projectId: string;
  intent: DesignIntent;
  workspacePath: string;        // <projectWorkspace>
  signal: {
    primaryCategoryId: string;
    subcategoryId: string | null;
    archetype: string | null;
    priceTier: "value" | "mainstream" | "premium" | "luxury" | null;
    promptText: string;         // user prompt or update prompt
    websiteSpec: WebsiteSpecRef;
  };
  // for update_token: list named tokens to patch (forwarded to existing token-patch service)
  tokenPatch?: ReadonlyArray<{ section: number; tokenName: string; nextValue: string }>;
};

export type DesignPipelineResult =
  | { status: "ok"; manifest: DesignManifest; designSourceHash: string }
  | { status: "needs-manual-review"; reason: ManualReviewReason; details: string }
  | { status: "no-op" };
```

## Behavior per intent

### `init`

1. `lazyMigrateIfNeeded(workspacePath)` — no-op khi `init` (chưa có manifest).
2. Validate signal qua `taxonomy-enrichment.server.ts` (subcategory soft).
3. `vibe-author.server.ts` → sinh `Vibe { descriptor, anchors[1-2], story }` dùng reference pool few-shot.
4. `block-composer.server.ts` → chọn block list (Tier 1 + group at-least-one + AI quyết optional + category-specific) tuân `compositionRules`.
5. `variant-ranker.server.ts` (high-impact) hoặc code-pick (supporting) → fill `variantId`.
6. `design-validator.server.ts` chạy structural + composition + cross-file + leak.
7. Compose `DESIGN.md` (Section 1 strict bullet + Section 2-8 token gen, reuse pipeline cũ).
8. **Atomic write**: blocks.json (tmp+rename) → DESIGN.md (tmp+rename).
9. Emit `design_generated`.
10. Result `{ ok, manifest, designSourceHash }`.

### `update_token`

1. `lazyMigrateIfNeeded(workspacePath)` (R-007).
2. Load manifest + DESIGN.md hiện tại; nếu không có manifest sau migration → throw (bug).
3. Forward `tokenPatch` cho `design-rule-patch-service` (đang có) — patch DESIGN.md sections 2-8.
4. Manifest **không đổi** ngoại trừ `lastIntent = "update_token"` và `generatedAt`.
5. Atomic write manifest + DESIGN.md.
6. **Không emit** `design_generated` (chỉ emit khi composition/vibe đổi). Token-patch service vẫn có log riêng.

### `update_no_design`

1. Return `{ status: "no-op" }` ngay; không I/O. Không phát event.

### `redesign`

1. `lazyMigrateIfNeeded`.
2. Load `designVersion` cũ → `designVersion = old + 1`, `shakeRevision = 0`.
3. Sinh seed mới, vibe mới, composition mới, variant mới (như `init`).
4. Validator + atomic write + emit event.

### `shake_design`

1. `lazyMigrateIfNeeded`.
2. Load manifest hiện tại.
3. `shakeRevision = old + 1`, `designVersion` giữ nguyên, recompute seed.
4. Giữ nguyên `vibe`, `composition.blockId/position`. Re-pick `variantId` cho **mọi** entry — high-impact vẫn re-rank, supporting code-pick.
5. DESIGN.md: tokens **không đổi**; nếu Section 6 component styling phụ thuộc variantId, regenerate phần liên quan (reuse pipeline hiện có cho component styling). Nếu không cần thay đổi DESIGN.md, vẫn cập nhật `designSourceHash` chỉ khi có thay đổi.
6. Validator + atomic write + emit event.

## Failure modes (FR-016)

| Mode | Source | Action |
|---|---|---|
| 1. Taxonomy fail | category lookup | retry 1× → heuristic fallback (lookup table TR-006) |
| 2. Vibe fail | vibe-author returns invalid | retry 1× → heuristic fallback (category → defaultAnchor) |
| 3. Composition fail | composer breaks rule | retry 1× → mark `needs-manual-review`, NO write |
| 4. Affinity fail | variant không match anchor | retry 1× → mark `needs-manual-review`, NO write |
| 5. Cross-file fail | Section 1 anchors ≠ manifest.vibe.anchors | retry 1× → mark `needs-manual-review`, NO write |
| 6. Manifest JSON corrupt | parse fail | retry 1× read → throw (bug) |
| 7. Leak fail (template token) | leaked-validator | reuse pipeline hiện có → fallback heuristic, NO persist |

`ManualReviewReason` = `"taxonomy" | "vibe" | "composition" | "affinity" | "cross-file" | "leak" | "manifest-corrupt"`.

## Determinism contract (FR-014)

- Cùng `(signal, designVersion, shakeRevision)` → cùng manifest (variant choices, composition order).
- Vibe author dùng `temperature 0.4` cho descriptor (D8 yêu cầu free-text độc nhất per project) nhưng anchors phải determinstic theo signal — nếu cần determinism toàn vibe, descriptor được hash-tag bằng project signal, AI rerun cho tới khi `anchors` ổn định trong 2 lần liên tiếp (acceptance test).
- Variant ranker: temperature 0.2; seed-pick là cơ chế đa dạng ổn định.

## Atomic write order (R-003)

1. Compose tất cả output trong-bộ-nhớ.
2. Validator chạy trên output trong-bộ-nhớ.
3. `fs.promises.writeFile(blocks.json.tmp)` → `fs.promises.rename`.
4. `fs.promises.writeFile(DESIGN.md.tmp)` → `fs.promises.rename`.
5. Trả về result; emit telemetry sau cùng.

## Tests phải tồn tại (sẽ chi tiết hoá ở /speckit-tasks)

- 5 acceptance scenario US1-US4 trong `spec.md` đều có integration test.
- Determinism test: chạy `init` 3 lần với cùng input → 3 manifest identical (sau khi normalize `generatedAt`).
- `update_no_design` không tạo file change.
- `update_token` chỉ đổi DESIGN.md sections 2-8, manifest content khác giá trị `generatedAt`/`lastIntent` thì giữ nguyên.
- `shake_design` đổi `composition[].variantId` cho tất cả block, giữ `composition[].blockId/position`.
- Failure mode 3 (composition) → result `needs-manual-review`, không có file mới ghi xuống workspace.
