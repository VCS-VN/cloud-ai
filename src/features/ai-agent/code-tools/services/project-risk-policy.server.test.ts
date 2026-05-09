import { describe, expect, it } from "vitest";
import { evaluateProjectRiskPolicy } from "./project-risk-policy.server";

describe("project risk policy", () => {
  it("allows small source changes", () => {
    expect(evaluateProjectRiskPolicy({ changedFiles: ["src/App.tsx"] }).requiresHumanReview).toBe(false);
  });

  it("requires review for broad or sensitive changes", () => {
    expect(evaluateProjectRiskPolicy({ changedFiles: Array.from({ length: 13 }, (_, index) => `src/${index}.tsx`) }).requiresHumanReview).toBe(true);
    expect(evaluateProjectRiskPolicy({ changedFiles: [".env"] }).requiresHumanReview).toBe(true);
    expect(evaluateProjectRiskPolicy({ changedFiles: ["package.json"] }).requiresHumanReview).toBe(true);
  });
});
