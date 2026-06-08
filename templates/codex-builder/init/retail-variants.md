# Retail Design Variants Prompt

## Purpose

When the agent is initializing a brand-new storefront, it MUST emit exactly four
retail-vibe design variants for the user to pick from. These variants are
visualized as a small palette swatch + a one-line description; the user picks
one (or types a custom answer) and the agent builds the storefront in line with
that direction.

## Output contract (strict JSON schema)

The agent's turn output MUST be a JSON array of exactly 4 items, or an object
of shape `{ "variants": [ ... ] }` containing 4 items. Each item:

```json
{
  "id": "minimal-retail",
  "label": "Minimal Retail",
  "description": "Khoảng trắng rộng, typography thanh thoát, ưu tiên sản phẩm.",
  "preview": {
    "font": "Inter",
    "palette": ["#ffffff", "#1a1a1a", "#cccccc"],
    "motion": 0.2,
    "density": 0.5
  }
}
```

Validation rules (server-side; payloads that fail are retried once):
- Exactly 4 variants per init clarification.
- `label` ≤ 40 chars, `description` ≤ 240 chars (target 80-160 chars; the parser auto-truncates anything longer).
- `description` MUST NOT contain file paths, code identifiers, framework names,
  or code snippets — the chat surfaces this string verbatim and the privacy
  filter will reject leaks.
- `preview.palette` length is 3–5; each entry is a 6- or 8-digit hex starting
  with `#`.
- `preview.motion` and `preview.density` are floats in `[0, 1]`.
- `id` values are unique within the array.

## Four retail vibes (always present)

1. **Minimalist retail** — wide whitespace, calm typography (sans-serif),
   product imagery does the talking; restrained palette (1 neutral + 1 ink +
   1 accent).
2. **Warm retail** — friendly, approachable; warm ivory / kraft / earthy
   browns; soft motion; readable serif or humanist sans.
3. **Luxury retail** — black + ink, gilded gold or champagne accent, generous
   leading, thin display serif; minimal motion.
4. **Playful retail** — bright multi-hue palette (3–4 saturated colors), fun
   geometric forms, playful sans-serif; higher motion intensity.

These four vibes are the canonical set. The agent may name them differently
if the prompt provides specific direction, but the COUNT is always 4 and the
quality bar above must hold.

## Few-shot examples (canonical)

### Example A — minimalist coffee retail

```json
[
  {
    "id": "minimal-paper",
    "label": "Paper Minimal",
    "description": "Khoảng trắng rộng, sản phẩm là tâm điểm, typography sạch thoáng.",
    "preview": {
      "font": "Inter",
      "palette": ["#ffffff", "#111111", "#d4d4d4"],
      "motion": 0.15
    }
  },
  {
    "id": "warm-kraft",
    "label": "Kraft Warm",
    "description": "Tông kem ấm áp, ánh nâu thân thiện, mời gọi khách dừng chân.",
    "preview": {
      "font": "Lora",
      "palette": ["#fdf6ec", "#a05a2c", "#5e3a1d", "#e7c894"],
      "motion": 0.4
    }
  },
  {
    "id": "luxury-noir",
    "label": "Noir Luxury",
    "description": "Đen huyền, ánh đồng champagne, không gian cao cấp tinh tế.",
    "preview": {
      "font": "Playfair Display",
      "palette": ["#0e0e0e", "#bfa269", "#f4f1ec"],
      "motion": 0.25,
      "density": 0.55
    }
  },
  {
    "id": "playful-citrus",
    "label": "Citrus Playful",
    "description": "Sắc tươi sáng, hoạ tiết vui mắt, hợp khách trẻ trung.",
    "preview": {
      "font": "Quicksand",
      "palette": ["#fef08a", "#34d399", "#fb7185", "#60a5fa"],
      "motion": 0.7
    }
  }
]
```

### Example B — fashion retail

```json
[
  {
    "id": "minimal-runway",
    "label": "Runway Minimal",
    "description": "Sạch thoáng, ưu tiên ảnh sản phẩm, typography thanh thoát.",
    "preview": {
      "font": "Inter",
      "palette": ["#ffffff", "#0a0a0a", "#e5e5e5"],
      "motion": 0.2
    }
  },
  {
    "id": "warm-linen",
    "label": "Linen Warm",
    "description": "Tông vải thô ấm, mời gọi khách bước vào không gian thân thiện.",
    "preview": {
      "font": "DM Serif Display",
      "palette": ["#f8f1e7", "#b56b3d", "#3d2a1d"],
      "motion": 0.35
    }
  },
  {
    "id": "luxury-velvet",
    "label": "Velvet Luxury",
    "description": "Đen sâu, ánh kim, không gian tinh tế và cao cấp.",
    "preview": {
      "font": "Playfair Display",
      "palette": ["#0a0a0a", "#bfa269", "#f4f1ec"],
      "motion": 0.3,
      "density": 0.6
    }
  },
  {
    "id": "playful-pop",
    "label": "Pop Playful",
    "description": "Màu sắc rực rỡ, hoạ tiết hình học, năng lượng trẻ trung.",
    "preview": {
      "font": "Space Grotesk",
      "palette": ["#fde68a", "#22d3ee", "#fb7185", "#a3e635"],
      "motion": 0.75
    }
  }
]
```

## Anti-patterns (DO NOT do)

- DO NOT include file paths or component names (`<Hero />`, `Hero.tsx`).
- DO NOT mention the framework (Vite, TanStack, React).
- DO NOT include code fences or pseudocode.
- DO NOT exceed 4 variants. The UI is a 4-card layout.
- DO NOT use color names ("red", "blue") — only hex codes prefixed with `#`.
