# Contract: `design_generated` Telemetry Event

**Module**: `src/features/ai-agent/design/telemetry.ts`
**Sink (MVP)**: structured logger (JSON line) — R-006. Sink layer pluggable cho follow-up (DB / OTel / external).
**Spec FR**: FR-019.

## Schema

```ts
import { z } from "zod";

export const DesignGeneratedEventSchema = z.object({
  type: z.literal("design_generated"),
  schemaVersion: z.literal(1),
  projectId: z.string().uuid(),
  intent: z.enum(["init", "redesign", "shake_design"]),  // NOTE: update_token / update_no_design không phát event
  vibe: z.object({
    descriptor: z.string().min(1).max(200),
    anchors: z.array(z.string()).min(1).max(2),
  }),
  category: z.object({
    primary: z.string(),
    subcategory: z.string().nullable(),
  }),
  variantChoices: z.array(z.object({
    blockId: z.string(),
    variantId: z.string(),
    tier: z.enum(["high-impact", "supporting"]),
  })).min(1),
  designVersion: z.number().int().min(1),
  shakeRevision: z.number().int().min(0),
  generatedAt: z.string().datetime(),  // ISO-8601 UTC
});

export type DesignGeneratedEvent = z.infer<typeof DesignGeneratedEventSchema>;
```

## Emission contract

```ts
export async function emitDesignGenerated(event: DesignGeneratedEvent): Promise<void>;
```

- Caller PHẢI parse qua `DesignGeneratedEventSchema.parse(payload)` (fail fast nếu sai shape).
- Emission KHÔNG block pipeline; lỗi sink chỉ log warn.
- Sink mặc định ở MVP: `console.info(JSON.stringify(event))` (server log channel) — sẽ thay bằng adapter cụ thể trong follow-up.

## Variance metrics (downstream computation, không thuộc emit)

Telemetry consumer (sau phase này) sẽ tính:

| Metric | Source field | Mục tiêu |
|---|---|---|
| Vibe descriptor cardinality | `vibe.descriptor` distinct count / 30-day window | gần = số project (D19) |
| Variant pick distribution per high-impact block | `variantChoices[].variantId` filter `tier=high-impact` | top-1 cluster < 25% (SC-001, TR-011) |
| Anchor combination distribution | sorted-tuple `vibe.anchors` | spread đều |
| Migration count | `intent=init` & flag từ lazy-migration | quan sát rollout (TR-007) |

## Privacy

- Không phát PII. `projectId` UUID là acceptable.
- `descriptor`/`story` không nên chứa user prompt raw — vibe-author chốt phrasing trước khi vào event.

## Failure modes

| Lỗi | Hành vi |
|---|---|
| Schema parse fail tại emit | log error + drop event; pipeline tiếp tục (telemetry không phải critical path) |
| Sink throw | log warn + drop event; không retry |

## Tests phải tồn tại

- Init project → 1 event với intent `init`, đủ field, schema parse pass.
- `update_no_design` → 0 event.
- `update_token` → 0 event (chỉ token-patch service log riêng).
- `redesign` → 1 event với `designVersion = old+1`.
- `shake_design` → 1 event với `shakeRevision = old+1`, `vibe` giữ nguyên giữa 2 event liên tiếp.
- Schema fail (vibe.anchors rỗng) → emit drop, pipeline ok.
