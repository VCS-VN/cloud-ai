import { describe, expect, it } from "vitest";
import {
  buildVariantBuildPrompt,
  generateRetailVariants,
} from "@/features/agents/codex/runtime/design-variants.server";
import type { DesignVariant } from "@/shared/project-types";

const sampleVariants: DesignVariant[] = [
  {
    id: "v1",
    label: "Minimal",
    description: "Khoảng trắng rộng, typography thanh thoát.",
    preview: { font: "Inter", palette: ["#ffffff", "#000000", "#cccccc"], motion: 0.2 },
  },
  {
    id: "v2",
    label: "Warm",
    description: "Tông màu ấm, gần gũi với khách hàng.",
    preview: { font: "Lora", palette: ["#fdf6ec", "#a05a2c", "#5e3a1d"], motion: 0.4 },
  },
  {
    id: "v3",
    label: "Luxury",
    description: "Đen huyền, ánh kim, không gian cao cấp.",
    preview: { font: "Playfair Display", palette: ["#0e0e0e", "#bfa269", "#f4f1ec"], motion: 0.3 },
  },
  {
    id: "v4",
    label: "Playful",
    description: "Sắc màu tươi sáng, hoạ tiết vui mắt.",
    preview: { font: "Quicksand", palette: ["#fef08a", "#34d399", "#fb7185"], motion: 0.7 },
  },
];

describe("US4 — design variant generation + selection wiring", () => {
  it("generateRetailVariants validates the codex turn output and returns 4 variants", async () => {
    const json = JSON.stringify(sampleVariants);
    const result = await generateRetailVariants({
      runTurn: async () => ({ finalResponse: json }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variants).toHaveLength(4);
    expect(result.variants[0].id).toBe("v1");
  });

  it("generateRetailVariants retries once on invalid JSON, then succeeds", async () => {
    let attempt = 0;
    const result = await generateRetailVariants({
      runTurn: async () => {
        attempt += 1;
        if (attempt === 1) return { finalResponse: "not json" };
        return { finalResponse: JSON.stringify(sampleVariants) };
      },
    });
    expect(result.ok).toBe(true);
    expect(attempt).toBe(2);
  });

  it("generateRetailVariants gives up after 1 retry when JSON keeps failing", async () => {
    let attempt = 0;
    const result = await generateRetailVariants({
      runTurn: async () => {
        attempt += 1;
        return { finalResponse: "still not json" };
      },
    });
    expect(result.ok).toBe(false);
    expect(attempt).toBe(2);
  });

  it("Selecting a variant by optionId seeds the build prompt with palette + font tokens", () => {
    const selected = sampleVariants[1];
    const prompt = buildVariantBuildPrompt({ selectedVariant: selected });
    expect(prompt).toContain("Selected design variant: Warm");
    expect(prompt).toContain("Palette: #fdf6ec, #a05a2c, #5e3a1d");
    expect(prompt).toContain("Font: Lora");
    // Description is privacy-safe (no paths/code/framework tokens) and surfaces.
    expect(prompt).toContain("gần gũi với khách hàng");
  });
});
