import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ActiveRunExistsError,
  createBuilderRunHandle,
  getBuilderRunHandle,
  publishBuilderRunEvent,
  resetBuilderRunRegistryForTest,
} from "@/features/agents/codex/runtime/builder-run-registry.server";

describe("builder-run-registry", () => {
  beforeEach(() => {
    resetBuilderRunRegistryForTest();
  });

  it("creates a handle and registers it", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    expect(getBuilderRunHandle("r1")).toBe(handle);
  });

  it("rejects a second active run for the same project", () => {
    createBuilderRunHandle({ runId: "r1", projectId: "p1", userId: "u1" });
    expect(() =>
      createBuilderRunHandle({ runId: "r2", projectId: "p1", userId: "u1" }),
    ).toThrow(ActiveRunExistsError);
  });

  it("publishes events to subscribers and buffers them on the handle", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    const listener = vi.fn();
    handle.subscribers.add(listener);
    publishBuilderRunEvent(handle, {
      type: "milestone",
      runId: "r1",
      milestone: "planning",
      at: 1,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(handle.events).toHaveLength(1);
    expect(handle.status).toBe("planning");
  });

  it("releases the project lock on terminal events", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    publishBuilderRunEvent(handle, { type: "done", runId: "r1", milestone: "done", at: 2 });
    const handle2 = createBuilderRunHandle({
      runId: "r2",
      projectId: "p1",
      userId: "u1",
    });
    expect(handle2.runId).toBe("r2");
  });

  it("releases the lock on failed events too", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    publishBuilderRunEvent(handle, {
      type: "failed",
      runId: "r1",
      milestone: "failed",
      failureCode: "boundary_violation",
      message: "x",
      at: 3,
    });
    expect(() =>
      createBuilderRunHandle({ runId: "r2", projectId: "p1", userId: "u1" }),
    ).not.toThrow();
  });
});
