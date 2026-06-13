import { describe, expect, it } from "vitest";
import {
  detectStyleDirection,
  buildDetectedStyleBuildPrompt,
  type DetectedStyle,
} from "@/features/agents/codex/runtime/design-variants.server";

describe("detectStyleDirection", () => {
  it("returns hasStyleDirection=true with the parsed style when the prompt names a direction", async () => {
    const json = JSON.stringify({
      hasStyleDirection: true,
      style: {
        label: "Neo-luxe gold",
        summary: "Đen huyền, ánh kim, cao cấp cho khách sang.",
        palette: ["#0e0e0e", "#bfa269"],
        font: "Playfair Display",
        motion: 0.3,
      },
    });
    const result = await detectStyleDirection({
      runTurn: async () => ({ finalResponse: json }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.hasStyleDirection) throw new Error("expected a direction");
    expect(result.style.label).toBe("Neo-luxe gold");
    expect(result.style.palette).toEqual(["#0e0e0e", "#bfa269"]);
    expect(result.style.font).toBe("Playfair Display");
  });

  it("returns hasStyleDirection=false when the prompt has no visual cue", async () => {
    const result = await detectStyleDirection({
      runTurn: async () => ({ finalResponse: JSON.stringify({ hasStyleDirection: false }) }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hasStyleDirection).toBe(false);
  });

  it("treats hasStyleDirection=true with no style object as no direction", async () => {
    const result = await detectStyleDirection({
      runTurn: async () => ({ finalResponse: JSON.stringify({ hasStyleDirection: true }) }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hasStyleDirection).toBe(false);
  });

  it("strips a code fence before parsing", async () => {
    const fenced = "```json\n" + JSON.stringify({
      hasStyleDirection: true,
      style: { label: "Studio café", summary: "Ấm áp, mộc mạc." },
    }) + "\n```";
    const result = await detectStyleDirection({
      runTurn: async () => ({ finalResponse: fenced }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.hasStyleDirection) throw new Error("expected a direction");
    expect(result.style.label).toBe("Studio café");
  });

  it("drops unsalvageable palette colors and omits palette when none survive", async () => {
    const json = JSON.stringify({
      hasStyleDirection: true,
      style: { label: "X", summary: "Y", palette: ["not-a-color", "也不是"] },
    });
    const result = await detectStyleDirection({
      runTurn: async () => ({ finalResponse: json }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.hasStyleDirection) throw new Error("expected a direction");
    expect(result.style.palette).toBeUndefined();
  });

  it("normalizes shorthand/named palette colors to hex", async () => {
    const json = JSON.stringify({
      hasStyleDirection: true,
      style: { label: "X", summary: "Y", palette: ["#abc", "gold"] },
    });
    const result = await detectStyleDirection({
      runTurn: async () => ({ finalResponse: json }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.hasStyleDirection) throw new Error("expected a direction");
    expect(result.style.palette).toEqual(["#aabbcc", "#ffd700"]);
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    let attempt = 0;
    const result = await detectStyleDirection({
      runTurn: async () => {
        attempt += 1;
        if (attempt === 1) return { finalResponse: "not json" };
        return { finalResponse: JSON.stringify({ hasStyleDirection: false }) };
      },
    });
    expect(result.ok).toBe(true);
    expect(attempt).toBe(2);
  });

  it("gives up with ok:false after retries keep failing", async () => {
    let attempt = 0;
    const result = await detectStyleDirection({
      runTurn: async () => {
        attempt += 1;
        return { finalResponse: "still not json" };
      },
    });
    expect(result.ok).toBe(false);
    expect(attempt).toBe(2);
  });
});

describe("buildDetectedStyleBuildPrompt", () => {
  it("includes the direction, tokens, and a taste-skill reassertion", () => {
    const style: DetectedStyle = {
      label: "Neo-luxe gold",
      summary: "Đen huyền, ánh kim.",
      palette: ["#0e0e0e", "#bfa269"],
      font: "Playfair Display",
      motion: 0.3,
    };
    const prompt = buildDetectedStyleBuildPrompt(style);
    expect(prompt).toContain("Design direction: Neo-luxe gold");
    expect(prompt).toContain("Palette: #0e0e0e, #bfa269");
    expect(prompt).toContain("Font: Playfair Display");
    expect(prompt).toContain("do NOT ask the user to choose a style");
    expect(prompt).toContain("taste skill");
  });

  it("omits optional token lines when absent", () => {
    const prompt = buildDetectedStyleBuildPrompt({
      label: "Studio café",
      summary: "Ấm áp, mộc mạc.",
    });
    expect(prompt).toContain("Design direction: Studio café");
    expect(prompt).not.toContain("Palette:");
    expect(prompt).not.toContain("Font:");
    expect(prompt).not.toContain("Motion intensity:");
  });
});
