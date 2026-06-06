import { describe, it, expect, beforeEach } from "vitest";
import {
  PROJECT_VIOLATION_SUSPEND_THRESHOLD,
  USER_VIOLATION_ESCALATE_THRESHOLD,
  isProjectSuspended,
  recordBoundaryViolation,
  resetViolationStateForTest,
} from "@/features/agents/codex/runtime/violation-counter.server";

describe("violation-counter", () => {
  beforeEach(() => resetViolationStateForTest());

  it("does not suspend below the threshold", () => {
    const result = recordBoundaryViolation({
      projectId: "p1",
      userId: "u1",
      layer: "diff_gate",
    });
    expect(result.suspended).toBe(false);
    expect(isProjectSuspended("p1")).toBe(false);
  });

  it("suspends a project at the threshold", () => {
    let last;
    for (let i = 0; i < PROJECT_VIOLATION_SUSPEND_THRESHOLD; i++) {
      last = recordBoundaryViolation({
        projectId: "p1",
        userId: "u1",
        layer: "diff_gate",
      });
    }
    expect(last?.suspended).toBe(true);
    expect(isProjectSuspended("p1")).toBe(true);
  });

  it("escalates a user when their cross-project count crosses the user threshold", () => {
    let last;
    for (let i = 0; i < USER_VIOLATION_ESCALATE_THRESHOLD; i++) {
      last = recordBoundaryViolation({
        projectId: `p${i}`,
        userId: "shared-user",
        layer: "diff_gate",
      });
    }
    expect(last?.escalated).toBe(true);
  });

  it("tolerates undefined userId without crashing", () => {
    const result = recordBoundaryViolation({
      projectId: "p2",
      userId: undefined,
      layer: "diff_gate",
    });
    expect(result.user).toBeNull();
    expect(result.escalated).toBe(false);
  });
});
