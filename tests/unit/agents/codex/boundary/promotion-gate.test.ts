import path from "node:path";
import { describe, it, expect } from "vitest";
import { runPromotionGate } from "@/features/agents/codex/boundary/promotion-gate.server";
import type { PathGuardContext } from "@/features/agents/codex/boundary/path-guard.server";

const draftRoot = path.resolve("/tmp/draft");

function makeCtx(overrides: Partial<PathGuardContext> = {}): PathGuardContext {
  return {
    projectId: "project-1",
    userId: "user-1",
    draftWorkspacePath: draftRoot,
    ...overrides,
  };
}

describe("runPromotionGate", () => {
  it("accepts identical contexts", () => {
    const expected = makeCtx();
    const current = makeCtx();
    expect(runPromotionGate({ expected, current })).toEqual({ ok: true });
  });

  it("rejects mismatched projectId with project_id_mismatch", () => {
    const expected = makeCtx({ projectId: "project-1" });
    const current = makeCtx({ projectId: "project-2" });
    expect(runPromotionGate({ expected, current })).toEqual({
      ok: false,
      reason: "project_id_mismatch",
    });
  });

  it("rejects mismatched userId with user_id_mismatch", () => {
    const expected = makeCtx({ userId: "u1" });
    const current = makeCtx({ userId: undefined });
    expect(runPromotionGate({ expected, current })).toEqual({
      ok: false,
      reason: "user_id_mismatch",
    });
  });

  it("rejects mismatched draftWorkspacePath with draft_path_mismatch", () => {
    const expected = makeCtx({
      draftWorkspacePath: path.resolve("/tmp/draft-a"),
    });
    const current = makeCtx({
      draftWorkspacePath: path.resolve("/tmp/draft-b"),
    });
    expect(runPromotionGate({ expected, current })).toEqual({
      ok: false,
      reason: "draft_path_mismatch",
    });
  });

  it("accepts absolute and equivalent relative-form drafts that resolve to the same canonical path", () => {
    const absolute = path.resolve("/tmp/draft");
    const expected = makeCtx({ draftWorkspacePath: absolute });
    const current = makeCtx({
      draftWorkspacePath: path.join(absolute, "..", "draft"),
    });
    expect(runPromotionGate({ expected, current })).toEqual({ ok: true });
  });
});
