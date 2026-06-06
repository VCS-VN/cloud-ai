import { describe, it, expect, beforeEach } from "vitest";
import {
  cancelBuilderRun,
} from "@/features/agents/codex/runtime/cancel-controller.server";
import {
  createBuilderRunHandle,
  publishBuilderRunEvent,
  resetBuilderRunRegistryForTest,
} from "@/features/agents/codex/runtime/builder-run-registry.server";

describe("cancel-controller", () => {
  beforeEach(() => resetBuilderRunRegistryForTest());

  it("returns not_found for an unknown runId", () => {
    const result = cancelBuilderRun({ runId: "nope", userId: "u1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("returns forbidden when the userId does not match the handle's owner", () => {
    createBuilderRunHandle({ runId: "r1", projectId: "p1", userId: "owner" });
    const result = cancelBuilderRun({ runId: "r1", userId: "intruder" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  it("aborts the controller and emits a cancelled event the first time", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    const result = cancelBuilderRun({ runId: "r1", userId: "u1" });
    expect(result.ok).toBe(true);
    expect(handle.abortController.signal.aborted).toBe(true);
    expect(handle.events.some((e) => e.type === "cancelled")).toBe(true);
  });

  it("is idempotent: a second cancel returns ok with alreadyCancelled flag", () => {
    createBuilderRunHandle({ runId: "r1", projectId: "p1", userId: "u1" });
    cancelBuilderRun({ runId: "r1", userId: "u1" });
    const second = cancelBuilderRun({ runId: "r1", userId: "u1" });
    if (!second.ok) {
      expect(second.reason).toBe("already_terminal");
    } else {
      expect(second.alreadyCancelled).toBe(true);
    }
  });

  it("rejects cancel after a terminal event", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    publishBuilderRunEvent(handle, { type: "done", runId: "r1", milestone: "done", at: 1 });
    const result = cancelBuilderRun({ runId: "r1", userId: "u1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_terminal");
  });
});
