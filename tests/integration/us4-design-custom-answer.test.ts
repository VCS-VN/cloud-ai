import { describe, expect, it } from "vitest";
import { buildVariantBuildPrompt } from "@/features/agents/codex/runtime/design-variants.server";

describe("US4 — custom free-text answer overrides variant selection", () => {
  it("free text seeds the build prompt without referencing a specific variant", () => {
    const prompt = buildVariantBuildPrompt({ freeText: "Tôi muốn một storefront tone đen tuyền, kim loại đậm" });
    expect(prompt).toContain("User design guidance:");
    expect(prompt).toContain("Tôi muốn một storefront tone đen tuyền, kim loại đậm");
    expect(prompt).not.toContain("Selected design variant");
  });

  it("free text with only whitespace falls back to empty prompt", () => {
    expect(buildVariantBuildPrompt({ freeText: "   " })).toBe("");
  });

  it("when both selectedVariant and freeText are passed, freeText wins (custom overrides pick)", () => {
    const prompt = buildVariantBuildPrompt({
      freeText: "Custom guidance",
      selectedVariant: {
        id: "v1",
        label: "Minimal",
        description: "Spaces, calm typography.",
        preview: { font: "Inter", palette: ["#fff", "#000", "#ccc"], motion: 0.1 },
      },
    });
    expect(prompt).toContain("Custom guidance");
    expect(prompt).not.toContain("Selected design variant");
  });
});
