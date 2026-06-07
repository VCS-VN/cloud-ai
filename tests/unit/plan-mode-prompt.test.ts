import { describe, expect, it } from "vitest";
import { buildPlanModePrompt } from "@/features/agents/codex/runtime/plan-mode.server";

describe("Plan mode prompt template (R3)", () => {
  it("interpolates the user task into {task}", () => {
    const out = buildPlanModePrompt("Thêm hình ảnh vào hero section");
    expect(out).toContain("Task:\nThêm hình ảnh vào hero section");
  });

  it("includes both required sentences verbatim", () => {
    const out = buildPlanModePrompt("anything");
    expect(out).toContain("Your output must be a plan, not an implementation.");
    expect(out).toContain("Do not include full code patches unless explicitly asked.");
  });

  it("preserves the seven required section headings in order", () => {
    const out = buildPlanModePrompt("anything");
    const headings = [
      "## Understanding",
      "## Findings",
      "## Proposed Plan",
      "## Files To Change",
      "## Risks / Edge Cases",
      "## Validation Plan",
      "## Questions",
    ];
    let lastIndex = -1;
    for (const heading of headings) {
      const idx = out.indexOf(heading);
      expect(idx, `expected to find ${heading}`).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("declares the read-only sandbox via the hard rules block", () => {
    const out = buildPlanModePrompt("anything");
    expect(out).toContain("Hard rules");
    expect(out).toContain("Do NOT modify files.");
    expect(out).toContain("Do NOT create files.");
    expect(out).toContain("Do NOT delete files.");
    expect(out).toContain("Do NOT run commands that write to disk.");
  });

  it("opens with the PLAN MODE banner", () => {
    const out = buildPlanModePrompt("anything");
    expect(out.startsWith("You are in PLAN MODE.")).toBe(true);
  });
});
