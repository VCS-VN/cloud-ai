# Phase 1 — Data Model: Storefront Lens System

**Date**: 2026-05-29
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

Mô hình dữ liệu được phân tách 3 nhóm:
1. **Static assets** — block library, category taxonomy, vibe reference pool (đặt trong `templates/storefront/*.yaml`).
2. **Per-project state** — DESIGN.md + blocks.json (manifest) đặt cùng workspace project.
3. **Telemetry payload** — event `design_generated`.

Mỗi entity liệt kê: fields, validation rules, relationships, state transitions (nếu có).

---

## 1. Block (Static asset — block library entry)

**Source**: `templates/storefront/block-library.yaml`

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `blockId` | string (kebab-case) | yes | Mã định danh block (vd `hero`, `feature-band`, `trust-signals`). Unique trong library. |
| `tier` | enum `high-impact \| supporting` | yes | Quyết định nhánh chọn variant (D7). |
| `requirementLevel` | enum `tier-1 \| group \| optional` | yes | `tier-1` = always; `group` = at-least-one trong nhóm; `optional` = AI quyết. |
| `requirementGroup` | string \| null | conditional | Bắt buộc khi `requirementLevel = group` (vd `social-proof`). |
| `defaultPosition` | integer \| null | conditional | Bắt buộc khi `requirementLevel = tier-1` (FR-007); cho phép null cho block flex. |
| `applicableCategories` | string[] \| null | no | List primary category; null = match-all. |
| `applicableSubcategories` | string[] \| null | no | List subcategory; null = match-all (R-009). |
| `applicableVibes` | string[] \| null | no | Anchor list eligibility; null = match-all. |
| `commerceGoal` | enum `discovery \| conversion \| trust \| retention` | yes | Dùng để rank và cân bằng composition. |
| `compositionRules` | object | yes | Xem dưới. |
| `variants` | array<Variant> | yes | Tối thiểu 1 variant. |

### `compositionRules`

| Field | Type | Mô tả |
|---|---|---|
| `mustPrecede` | string[] | List blockId mà block này phải đứng trước. |
| `mustFollow` | string[] | List blockId mà block này phải đứng sau. |
| `mutuallyExclusive` | string[] | Không xuất hiện cùng các blockId này. |
| `maxOccurrences` | integer (>=1) | Số lần tối đa block xuất hiện trong composition. |

**Validation rules** (zod):
- `blockId`: `/^[a-z][a-z0-9-]*$/`.
- `defaultPosition`: int dương khi `tier-1`.
- Composition rules tự nhất quán: không liệt kê chính `blockId` trong `mustPrecede`/`mustFollow`/`mutuallyExclusive`.
- Composer enforce `mutuallyExclusive` symmetric (nếu A loại B thì B cũng loại A; nếu lệch sẽ warn nhưng không fail load).

---

## 2. Variant (Static asset — child of Block)

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `variantId` | string (kebab-case) | yes | Unique trong block (vd `editorial-overlay`). |
| `shape` | string | yes | Mô tả visual ngắn (free-text, dùng làm few-shot). |
| `vibeAffinity` | object<anchor, score 0-1> | yes | Bản đồ anchor → score; score >= 0.5 nghĩa là "tương thích cao". |
| `notes` | string \| null | no | Ghi chú reviewer. |

**Validation**:
- `vibeAffinity` keys phải nằm trong bounded anchor list (~12 anchor) — validator load anchor list từ `vibe-reference-pool.yaml` và cross-check (TR-016 single source).
- Score phải `>= 0` và `<= 1`; ít nhất 1 anchor với score >= 0.5 để variant không "lạc" mọi vibe.

---

## 3. Anchor (Static asset — bounded list)

**Source**: `templates/storefront/vibe-reference-pool.yaml` — phần `anchors:`.

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `id` | string (kebab-case) | yes | Vd `retro`, `minimalist`, `playful`. |
| `description` | string | yes | 1 câu mô tả vibe. |
| `legacyLabels` | string[] | no | Map từ nhãn vibe cũ (TR-008) → anchor mới khi migrate. |

**Constraints**:
- Tổng số anchor ~12 (D8).
- `legacyLabels` union không trùng giữa các anchor.

---

## 4. ReferencePoolEntry (Static asset — few-shot example)

**Source**: `templates/storefront/vibe-reference-pool.yaml` — phần `examples:`.

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `id` | string | yes | Unique. |
| `anchors` | string[] (1-2 anchor) | yes | Tham chiếu Anchor.id. |
| `applicableCategories` | string[] | yes | Primary categories liên quan. |
| `descriptor` | string | yes | Free-text descriptor mẫu. |
| `story` | string | yes | 1-3 câu narrative thương mại. |
| `antiPatterns` | string[] \| null | no | Mô tả "tránh" (D16). |

---

## 5. CategoryTaxonomy (Static asset)

**Source**: `templates/storefront/categories.yaml`

```yaml
primary:
  - id: fashion-apparel
    label: Fashion & Apparel
    subcategories:
      - id: streetwear
        label: Streetwear
      - id: tailored
        label: Tailored
  - id: home-living
    ...
```

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `primary[].id` | string (kebab-case) | yes | Unique trong taxonomy. |
| `primary[].label` | string | yes | Hiển thị. |
| `primary[].subcategories[].id` | string (kebab-case) | yes | Unique trong primary. |
| `primary[].subcategories[].label` | string | yes | Hiển thị. |

**Constraints**:
- ~20 primary, ~80-120 subcategory tổng (D24).
- `subcategory.id` chỉ duy nhất trong scope primary cha (cho phép trùng giữa primary khác nhau).
- Loader (`loadCategoryTaxonomy`) là single-source-of-truth (TR-016).

---

## 6. Vibe (Per-project value object)

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `descriptor` | string (1-200 chars) | yes | Free-text độc nhất theo project (D8). |
| `anchors` | string[] (1-2 phần tử, anchor.id) | yes | Bounded anchors (D9a). |
| `story` | string (1-3 câu) | yes | Narrative thương mại (D15). |

**Validation**:
- `anchors.length ∈ [1, 2]`.
- Mỗi `anchors[i]` ∈ Anchor.id.
- `descriptor` không trùng "category default" (heuristic-style detection để tránh fallback ngầm thành descriptor).

---

## 7. CompositionEntry (Per-project — element of `composition[]`)

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `blockId` | string | yes | Tham chiếu Block.blockId. |
| `variantId` | string | yes | Tham chiếu Variant.variantId thuộc block. |
| `tier` | enum `high-impact \| supporting` | yes | Sao lưu để telemetry không phải re-lookup. |
| `position` | integer (>=0) | yes | Vị trí thứ tự trong page. |
| `rankRationale` | string \| null | conditional | Required khi tier = high-impact (lưu rationale của ranker, D11). |

**Validation**:
- `position` unique trong composition.
- `(blockId, position)` thoả `compositionRules` của Block.
- `composition` chứa đủ tier-1 + ít nhất 1 block thuộc mỗi `requirementGroup` đã khai báo (FR-006).

---

## 8. DesignManifest (`blocks.json`)

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `manifestVersion` | enum `1` | yes | Schema version, sẵn cho migration sau này. |
| `designVersion` | integer (>=1) | yes | Tăng mỗi `redesign`. |
| `shakeRevision` | integer (>=0) | yes | Tăng mỗi `shake_design`; reset về 0 khi `redesign`. |
| `seed` | string (sha256 hex) | yes | `hash(projectId, designVersion, shakeRevision)` (R-005). |
| `vibe` | Vibe | yes | Object Vibe (Section 6). |
| `composition` | CompositionEntry[] | yes | Theo thứ tự `position` tăng dần. |
| `generatedAt` | ISO-8601 timestamp | yes | UTC, set ở mỗi lần ghi. |
| `lastIntent` | enum 5 intent | yes | Intent gây ra lần ghi gần nhất. |

**Validation**: dùng zod (R-002). `composition` không rỗng. `vibe.anchors[]` cùng tập với `DESIGN.md` Section 1 (cross-file check).

**Path**: `<projectWorkspace>/blocks.json`. Atomic write (R-003).

---

## 9. DESIGN.md Section 1 (Per-project)

| Bullet | Format | Required |
|---|---|---|
| `Descriptor:` | `**Descriptor:** <text>` | yes |
| `Anchors:` | `**Anchors:** <a>, <b>` | yes |
| `Story:` | `**Story:** <1-3 câu>` | yes |

Cross-file rule: Anchors trong DESIGN.md == `vibe.anchors` trong manifest (FR-015 anchor-mismatch).

---

## 10. DesignGeneratedEvent (Telemetry payload)

```ts
type DesignGeneratedEvent = {
  type: "design_generated";
  projectId: string;
  intent: "init" | "update_token" | "update_no_design" | "redesign" | "shake_design";
  vibeDescriptor: string;
  anchors: string[];          // 1-2 anchor IDs
  category: { primary: string; subcategory: string | null };
  variantChoices: Array<{ blockId: string; variantId: string; tier: "high-impact" | "supporting" }>;
  designVersion: number;
  shakeRevision: number;
  generatedAt: string;        // ISO-8601 UTC
};
```

**Constraints**:
- `intent === "update_no_design"` không phát event (không có gì để đo).
- Validator zod ở chỗ emit để fail fast nếu pipeline bug.

---

## State transitions

### Project design lifecycle

```
            init
              ↓
        [v=1, sR=0]
              ↓
   update_token  ─→  [v=1, sR=0]   (token only; manifest tokens part not affected vì manifest không lưu tokens — DESIGN.md sections 2-8 thay đổi)
              ↓
   shake_design  ─→  [v=1, sR=1] → [v=1, sR=2] → ...   (variant của TẤT CẢ block đổi)
              ↓
   redesign      ─→  [v=2, sR=0]   (vibe + composition + variant fresh; seed reset)
              ↓
   update_no_design ─→ no-op
```

**Invariants giữa các transition**:
- `init`: ghi mới cả DESIGN.md và blocks.json.
- `update_token`: chỉ patch DESIGN.md tokens (sections 2-8); manifest KHÔNG đổi (`shakeRevision`, `designVersion`, `seed`, `composition`, `vibe` giữ nguyên); `lastIntent = update_token`, `generatedAt` cập nhật.
- `update_no_design`: không write file nào.
- `redesign`: bump `designVersion`, reset `shakeRevision = 0`, recompute seed, sinh lại Vibe + Composition (variant kèm theo).
- `shake_design`: giữ `designVersion`, bump `shakeRevision`, recompute seed, giữ `vibe` + `composition.blockId/position`, replace `composition.variantId` cho **mọi** entry (D12).

---

## Relationships

```
Block ─┬─ contains ──→ Variant
       └─ references ─→ CategoryTaxonomy.primary/sub
                       Anchor.id (qua applicableVibes)

Vibe (project) ─→ refers Anchor.id

DesignManifest ─┬─ owns Vibe
                └─ has composition[] ─→ refs Block.blockId + Variant.variantId

DESIGN.md Section 1 ⇆ DesignManifest.vibe   (cross-file consistency)
```

---

## Mapping spec → entity

| Spec FR | Entity / Field |
|---|---|
| FR-001 (signal-first + seed) | `DesignManifest.seed`, `vibe.anchors`, taxonomy match |
| FR-002 (descriptor + 1-2 anchor) | `Vibe.descriptor`, `Vibe.anchors` |
| FR-003 (taxonomy 2 tier) | `CategoryTaxonomy.primary[].subcategories[]` |
| FR-004 (reference pool) | `ReferencePoolEntry` |
| FR-005 (block library shape) | `Block`, `Variant` |
| FR-006 (Tier 1 + at-least-one social-proof) | `Block.requirementLevel`, `requirementGroup` |
| FR-007 (default position) | `Block.defaultPosition` |
| FR-008 (high-impact rank) | `CompositionEntry.rankRationale` (high-impact only) |
| FR-009 (supporting code-pick) | `Block.tier = supporting` flow |
| FR-010 (rank top-3 schema) | Variant + Variant ranker contract (xem `contracts/variant-ranker.prompt.md`) |
| FR-011 (manifest fields) | `DesignManifest.*` |
| FR-012 (Section 1 bullet) | DESIGN.md Section 1 (Section 9 trên) |
| FR-013 (5 intent semantics) | State transitions |
| FR-014 (deterministic) | `seed` recompute từ `(projectId, designVersion, shakeRevision)` |
| FR-015 (full validation) | Cross-file Section 1 ↔ manifest, composition rules |
| FR-016 (per-failure-mode) | Validator + needs-manual-review flag (out-of-band, không trong manifest) |
| FR-017/018 (migration) | `lazy-migration.server.ts` đọc DESIGN.md cũ → tạo manifest |
| FR-019 (telemetry) | `DesignGeneratedEvent` |
| FR-020 (skill artifact) | Out-of-band — `.agents/skills/storefront-design/SKILL.md` (không phải data entity runtime) |
