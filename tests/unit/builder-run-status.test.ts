import { describe, expect, it } from "vitest";
import {
  shouldForceTerminalOnDriverResolve,
  type BuilderRunStatus,
} from "@/features/agents/ui/builder-run-status";

describe("builder-run-status", () => {
  it("forces a terminal event when the driver resolves while still running", () => {
    const running: BuilderRunStatus[] = [
      "queued",
      "loading_context",
      "planning",
      "creating_draft",
      "building_pages",
      "checking_preview",
      "repairing",
      "publishing",
    ];

    for (const status of running) {
      expect(shouldForceTerminalOnDriverResolve(status)).toBe(true);
    }
  });

  it("does not force terminal for completed or intentionally paused runs", () => {
    for (const status of ["done", "failed", "cancelled", "awaiting_clarification"] as const) {
      expect(shouldForceTerminalOnDriverResolve(status)).toBe(false);
    }
  });
});
