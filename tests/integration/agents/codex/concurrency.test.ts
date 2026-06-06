import { describe, it, expect, beforeEach } from "vitest";
import {
  ActiveRunExistsError,
  createBuilderRunHandle,
  publishBuilderRunEvent,
  resetBuilderRunRegistryForTest,
} from "@/features/agents/codex/runtime/builder-run-registry.server";
import {
  inspectActiveRunLock,
  isProjectLocked,
} from "@/features/agents/codex/runtime/active-run-lock.server";

describe("active-run lock (US8 concurrency)", () => {
  beforeEach(() => resetBuilderRunRegistryForTest());

  it("reports projectId as unlocked before any run starts", () => {
    expect(isProjectLocked("p1")).toBe(false);
    expect(inspectActiveRunLock("p1").activeRunId).toBeNull();
  });

  it("locks the project when a run is created", () => {
    createBuilderRunHandle({ runId: "r1", projectId: "p1", userId: "u1" });
    expect(isProjectLocked("p1")).toBe(true);
    expect(inspectActiveRunLock("p1").activeRunId).toBe("r1");
  });

  it("throws ActiveRunExistsError on a second concurrent reservation", () => {
    createBuilderRunHandle({ runId: "r1", projectId: "p1", userId: "u1" });
    expect(() =>
      createBuilderRunHandle({ runId: "r2", projectId: "p1", userId: "u1" }),
    ).toThrow(ActiveRunExistsError);
  });

  it("releases the lock once a terminal event publishes", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    publishBuilderRunEvent(handle, { type: "done", runId: "r1", milestone: "done", at: 1 });
    expect(isProjectLocked("p1")).toBe(false);
    expect(() =>
      createBuilderRunHandle({ runId: "r2", projectId: "p1", userId: "u1" }),
    ).not.toThrow();
  });

  it("releases the lock on cancelled events", () => {
    const handle = createBuilderRunHandle({
      runId: "r1",
      projectId: "p1",
      userId: "u1",
    });
    publishBuilderRunEvent(handle, { type: "cancelled", runId: "r1", milestone: "cancelled", at: 1 });
    expect(isProjectLocked("p1")).toBe(false);
  });

  it("leaves other projects unaffected", () => {
    createBuilderRunHandle({ runId: "r1", projectId: "p1", userId: "u1" });
    expect(() =>
      createBuilderRunHandle({ runId: "r2", projectId: "p2", userId: "u1" }),
    ).not.toThrow();
    expect(isProjectLocked("p1")).toBe(true);
    expect(isProjectLocked("p2")).toBe(true);
  });
});
