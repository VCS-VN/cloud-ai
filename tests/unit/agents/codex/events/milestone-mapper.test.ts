import { describe, expect, it } from "vitest";
import {
  emitCancelled,
  emitDone,
  emitFailed,
  emitMilestone,
  mapCodexEventToMilestone,
  redactPaths,
} from "@/features/agents/codex/events/milestone-mapper.server";

describe("redactPaths", () => {
  it("replaces unix-style absolute paths with [path]", () => {
    const result = redactPaths("Error in /var/bin/projects/abc/src/index.ts at line 12");
    expect(result).not.toContain("/var/bin/");
    expect(result).toContain("[path]");
  });
});

describe("mapCodexEventToMilestone", () => {
  it("maps thread_start to loading_context", () => {
    expect(mapCodexEventToMilestone({ kind: "thread_start" })).toBe("loading_context");
  });

  it("maps promote_done to done", () => {
    expect(mapCodexEventToMilestone({ kind: "promote_done" })).toBe("done");
  });

  it("returns null for unknown event kinds", () => {
    expect(mapCodexEventToMilestone({ kind: "unknown_event" })).toBeNull();
  });
});

describe("emit helpers", () => {
  it("emitFailed redacts paths in the message", () => {
    const evt = emitFailed({
      runId: "r1",
      failureCode: "boundary_violation",
      message: "/etc/passwd was hit",
      at: 0,
    });
    expect(evt.type).toBe("failed");
    if (evt.type === "failed") {
      expect(evt.message).not.toContain("/etc/passwd");
      expect(evt.message).toContain("[path]");
    }
  });

  it("emitMilestone returns a milestone-typed discriminated union", () => {
    const evt = emitMilestone({ runId: "r1", milestone: "planning", at: 5 });
    expect(evt).toEqual({
      type: "milestone",
      runId: "r1",
      milestone: "planning",
      at: 5,
    });
  });

  it("emitDone and emitCancelled produce the expected shapes", () => {
    expect(emitDone("r1", 1)).toEqual({
      type: "done",
      runId: "r1",
      milestone: "done",
      at: 1,
    });
    expect(emitCancelled("r1", 2)).toEqual({
      type: "cancelled",
      runId: "r1",
      milestone: "cancelled",
      at: 2,
    });
  });
});
