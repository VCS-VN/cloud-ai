import { describe, expect, it } from "vitest";
import { generateRetailVariants } from "@/features/agents/codex/runtime/design-variants.server";

const VALID_CONTENT = `[
  {
    "id": "minimalist-retail",
    "label": "Minimalist Retail",
    "description": "Tối giản, sạch sẽ, tôn sản phẩm.",
    "preview": { "font": "Inter", "palette": ["#ffffff", "#000000", "#cccccc"], "motion": 0.2 }
  },
  {
    "id": "warm-retail",
    "label": "Warm Retail",
    "description": "Tông ấm áp, gần gũi.",
    "preview": { "font": "Lora", "palette": ["#fdf6ec", "#a05a2c", "#5e3a1d"], "motion": 0.4 }
  },
  {
    "id": "luxury-retail",
    "label": "Luxury Retail",
    "description": "Sang trọng, ánh kim.",
    "preview": { "font": "Playfair", "palette": ["#0e0e0e", "#bfa269", "#f4f1ec"], "motion": 0.3 }
  },
  {
    "id": "playful-retail",
    "label": "Playful Retail",
    "description": "Vui tươi, trẻ trung.",
    "preview": { "font": "Quicksand", "palette": ["#fef08a", "#34d399", "#fb7185"], "motion": 0.7 }
  }
]`;

describe("generateRetailVariants — robust parser (regression)", () => {
  it("accepts JSON wrapped in ```json fence (the real model output)", async () => {
    const wrapped = "```json\n" + VALID_CONTENT + "\n```";
    const result = await generateRetailVariants({
      runTurn: async () => ({ finalResponse: wrapped }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variants).toHaveLength(4);
      expect(result.variants[0].id).toBe("minimalist-retail");
    }
  });

  it("accepts JSON wrapped in plain ``` fence", async () => {
    const wrapped = "```\n" + VALID_CONTENT + "\n```";
    const result = await generateRetailVariants({
      runTurn: async () => ({ finalResponse: wrapped }),
    });
    expect(result.ok).toBe(true);
  });

  it('accepts {"variants": [...]} object wrapper', async () => {
    const wrapped = `{"variants": ${VALID_CONTENT}}`;
    const result = await generateRetailVariants({
      runTurn: async () => ({ finalResponse: wrapped }),
    });
    expect(result.ok).toBe(true);
  });

  it("accepts JSON buried in narrative prose", async () => {
    const buried = `Here are the variants you requested:\n\n${VALID_CONTENT}\n\nLet me know which one you prefer.`;
    const result = await generateRetailVariants({
      runTurn: async () => ({ finalResponse: buried }),
    });
    expect(result.ok).toBe(true);
  });

  it("normalizes drift: 'name' → 'label', 'vibe' → 'id'", async () => {
    const drifted = `[
      { "vibe": "minimalist retail", "name": "Minimalist", "description": "Tối giản.", "preview": { "font": "Inter", "palette": ["#ffffff", "#000000", "#cccccc"], "motion": 0.2 } },
      { "vibe": "warm retail", "name": "Warm", "description": "Ấm áp.", "preview": { "font": "Lora", "palette": ["#fdf6ec", "#a05a2c", "#5e3a1d"], "motion": 0.4 } },
      { "vibe": "luxury retail", "name": "Luxury", "description": "Sang trọng.", "preview": { "font": "Playfair", "palette": ["#0e0e0e", "#bfa269", "#f4f1ec"], "motion": 0.3 } },
      { "vibe": "playful retail", "name": "Playful", "description": "Vui tươi.", "preview": { "font": "Quicksand", "palette": ["#fef08a", "#34d399", "#fb7185"], "motion": 0.7 } }
    ]`;
    const result = await generateRetailVariants({
      runTurn: async () => ({ finalResponse: drifted }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variants[0].id).toBe("minimalist-retail");
      expect(result.variants[0].label).toBe("Minimalist");
    }
  });

  it("retries once on invalid JSON, then fails with reason", async () => {
    let calls = 0;
    const result = await generateRetailVariants({
      runTurn: async () => {
        calls++;
        return { finalResponse: "totally not json" };
      },
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(2); // 1 attempt + 1 retry
    if (!result.ok) {
      expect(result.reason).toContain("invalid JSON");
    }
  });
});
