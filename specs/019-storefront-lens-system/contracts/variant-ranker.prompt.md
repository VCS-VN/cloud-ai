# Contract: Variant Ranker Prompt

**Module**: `src/features/ai-agent/design/variant-ranker.server.ts`
**Spec FR**: FR-008 (high-impact rank), FR-010 (composition awareness, top-3 schema).
**Tradeoffs**: TR-013 (structured output), TR-014 (cache prefix), TR-015 (temperature).

## I/O signature

```ts
type RankerInput = {
  block: {
    blockId: string;
    tier: "high-impact";
    commerceGoal: "discovery" | "conversion" | "trust" | "retention";
    variants: Array<{
      variantId: string;
      shape: string;
      vibeAffinity: Record<string, number>;
    }>;
  };
  project: {
    projectId: string;
    primaryCategory: string;        // primary id
    subcategory: string | null;     // sub id
    archetype: string | null;
    priceTier: string | null;
    vibe: { descriptor: string; anchors: string[]; story: string };
  };
  alreadyComposedBlocks: Array<{ blockId: string; variantId: string; position: number }>;
};

type RankerOutput = {
  ranked: [
    { variantId: string; score: number; rationale: string },
    { variantId: string; score: number; rationale: string },
    { variantId: string; score: number; rationale: string }
  ];
};
```

`score ∈ [0, 1]`; sum không bắt buộc 1.

## Prompt structure

Prompt được chia 2 phần để tận dụng prompt caching (TR-014):

### Static prefix (cacheable)

Bao gồm theo thứ tự — KHÔNG đổi giữa các block trong cùng project nếu project signal/vibe giữ nguyên:

1. **Role**: "You rank storefront page block variants for commerce relevance and vibe coherence."
2. **Few-shot ví dụ** lấy từ reference pool theo `applicableCategories ⊇ project.primaryCategory` và overlap anchors. Pick top-3 ví dụ.
3. **Project signal**: `primaryCategory`, `subcategory`, `archetype`, `priceTier`.
4. **Project vibe**: `descriptor`, `anchors`, `story`.
5. **Block library context**: chèn entry block (commerceGoal, vibeAffinity bảng).

### Dynamic suffix (per-call)

1. **Block under rank**: `blockId`, `tier`, `commerceGoal`, full `variants[]`.
2. **Already composed**: `alreadyComposedBlocks[]` (blockId + variantId + position).
3. **Output instruction**: "Return exactly the top 3 variants ranked by combined commerce-fit and vibe-coherence. Do not invent variantIds. Penalize redundancy with already-composed blocks."
4. **Schema enforcement**: structured output với `response_format: json_schema` (zod schema) khớp `RankerOutput`.

## Output rules

- `ranked.length === 3`. Nếu input có < 3 variant, return `min(variants.length, 3)` và pipeline xử lý fallback (xem failure mode).
- `variantId` ∈ `block.variants[].variantId`.
- `score` round 4 chữ số.
- `rationale`: 1 câu, 30-200 chars, mô tả vì sao variant này phù hợp.

## Tiebreak code-side

1. Lấy `ranked[]` (top 3).
2. Nếu top-2 score chênh < 0.05 → coi như tie.
3. Compute `blockSeed = sha256(seed + ':' + blockId)`.
4. `pickIndex = parseInt(blockSeed.slice(0, 8), 16) % ranked.length`.
5. Chọn `ranked[pickIndex]` làm variant cuối.

## Determinism (TR-015)

- `temperature = 0.2` cho ranker.
- `top_p = 1`.
- `seed` field của OpenAI request = `parseInt(blockSeed.slice(0, 16), 16)` để tăng ổn định nội tại provider (best-effort).

## Failure modes

| Lỗi | Hành vi |
|---|---|
| JSON schema fail | retry 1× với `temperature = 0` → fallback: lấy `top 3 by max(vibeAffinity[anchor])` (heuristic, không gọi LLM) |
| Output reference variantId không tồn tại | retry 1× → fallback heuristic |
| Output thiếu rationale | retry 1× → fallback heuristic (rationale = "Heuristic affinity match: <anchor>=<score>") |
| Provider error | bubble up → caller mark `needs-manual-review` (composition fail mode) |

## Tests phải tồn tại

- Mock LLM trả ranked top-3 hợp lệ → pick deterministic theo seed.
- Mock LLM trả `variantId` không tồn tại → fallback heuristic kicks in.
- Mock LLM throw → caller nhận failure mode đúng.
- Two project khác `seed` → có thể chọn `pickIndex` khác cho cùng `ranked[]` (sanity).
