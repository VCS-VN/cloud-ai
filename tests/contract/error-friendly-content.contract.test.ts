import { describe, expect, it } from "vitest";
import { friendlyFailureMessage } from "@/server/services/builder-run-translator.server";
import { isPrivacySafe } from "@/server/functions/progress-mapper.server";
import type { BuilderRunFailureCode } from "@/features/agents/ui/builder-events";

const ALL_CODES: BuilderRunFailureCode[] = [
  "validation_failed",
  "boundary_violation",
  "config_unavailable",
  "cancelled",
  "preview_failed",
  "codex_runtime_failed",
  "blocked_request",
  "repair_exhausted",
  "required_skill_unavailable",
  "skill_unavailable",
  "interrupted_by_restart",
];

describe("Friendly error content contract — every BuilderRunFailureCode maps to a privacy-safe vi/en message", () => {
  for (const code of ALL_CODES) {
    it(`${code} has a non-empty privacy-safe vi message`, () => {
      const vi = friendlyFailureMessage(code, "vi");
      expect(vi.length).toBeGreaterThan(0);
      expect(isPrivacySafe(vi)).toBe(true);
    });
    it(`${code} has a non-empty privacy-safe en message`, () => {
      const en = friendlyFailureMessage(code, "en");
      expect(en.length).toBeGreaterThan(0);
      expect(isPrivacySafe(en)).toBe(true);
    });
  }

  it("vi messages do not include English framework tokens", () => {
    for (const code of ALL_CODES) {
      const vi = friendlyFailureMessage(code, "vi");
      // sanity — no Vite/React/TanStack/Drizzle leak
      expect(vi).not.toMatch(/vite|tanstack|drizzle|react/i);
    }
  });
});
