import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  checkPath,
  assertSameContext,
  isInsideDraft,
  type PathGuardContext,
} from "@/features/agents/codex/boundary/path-guard.server";

const draftRoot = path.resolve("/tmp/draft-test");

function makeCtx(overrides: Partial<PathGuardContext> = {}): PathGuardContext {
  return {
    projectId: "project-1",
    userId: "user-1",
    draftWorkspacePath: draftRoot,
    ...overrides,
  };
}

describe("checkPath", () => {
  it("rejects relative `..` traversal that escapes the draft", () => {
    const ctx = makeCtx();
    const result = checkPath(ctx, "../escaped.txt");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect([
        "path_traversal_outside_draft",
        "outside_draft_workspace",
      ]).toContain(result.reason);
    }
  });

  it("rejects deep relative traversal that escapes via multiple `..`", () => {
    const ctx = makeCtx();
    const result = checkPath(ctx, "../../../etc/passwd");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect([
        "path_traversal_outside_draft",
        "outside_draft_workspace",
      ]).toContain(result.reason);
    }
  });

  it("rejects absolute path outside the draft", () => {
    const ctx = makeCtx();
    const outside = path.resolve("/tmp/some-other-place/file.txt");
    const result = checkPath(ctx, outside);
    expect(result).toEqual({
      ok: false,
      reason: "outside_draft_workspace",
    });
  });

  it("accepts a valid relative path inside the draft", () => {
    const ctx = makeCtx();
    const result = checkPath(ctx, "src/index.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.relativePath).toBe(path.join("src", "index.ts"));
      expect(result.absolutePath).toBe(path.join(draftRoot, "src", "index.ts"));
    }
  });

  it("accepts a valid absolute path inside the draft", () => {
    const ctx = makeCtx();
    const abs = path.join(draftRoot, "app", "main.tsx");
    const result = checkPath(ctx, abs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.absolutePath).toBe(abs);
      expect(result.relativePath).toBe(path.join("app", "main.tsx"));
    }
  });

  it("rejects when draftWorkspacePath is empty", () => {
    const ctx = makeCtx({ draftWorkspacePath: "" });
    const result = checkPath(ctx, "src/index.ts");
    expect(result).toEqual({
      ok: false,
      reason: "missing_draft_workspace",
    });
  });

  it("rejects when projectId is empty", () => {
    const ctx = makeCtx({ projectId: "" });
    const result = checkPath(ctx, "src/index.ts");
    expect(result).toEqual({
      ok: false,
      reason: "missing_project_id",
    });
  });
});

describe("assertSameContext", () => {
  it("rejects mismatched projectId", () => {
    const a = makeCtx({ projectId: "project-1" });
    const b = makeCtx({ projectId: "project-2" });
    expect(assertSameContext(a, b)).toEqual({
      ok: false,
      reason: "project_id_mismatch",
    });
  });

  it("rejects mismatched userId (one undefined, one set)", () => {
    const a = makeCtx({ userId: undefined });
    const b = makeCtx({ userId: "user-1" });
    expect(assertSameContext(a, b)).toEqual({
      ok: false,
      reason: "user_id_mismatch",
    });
  });

  it("rejects mismatched draftWorkspacePath", () => {
    const a = makeCtx({ draftWorkspacePath: path.resolve("/tmp/draft-a") });
    const b = makeCtx({ draftWorkspacePath: path.resolve("/tmp/draft-b") });
    expect(assertSameContext(a, b)).toEqual({
      ok: false,
      reason: "draft_path_mismatch",
    });
  });

  it("accepts when all fields match", () => {
    const a = makeCtx();
    const b = makeCtx();
    expect(assertSameContext(a, b)).toEqual({ ok: true });
  });

  it("accepts when both userIds are undefined", () => {
    const a = makeCtx({ userId: undefined });
    const b = makeCtx({ userId: undefined });
    expect(assertSameContext(a, b)).toEqual({ ok: true });
  });
});

describe("isInsideDraft", () => {
  it("returns true for the draft root itself", () => {
    expect(isInsideDraft(draftRoot, draftRoot)).toBe(true);
  });

  it("returns true for a nested path", () => {
    expect(
      isInsideDraft(path.join(draftRoot, "src", "index.ts"), draftRoot),
    ).toBe(true);
  });

  it("returns false for a sibling directory", () => {
    expect(
      isInsideDraft(path.resolve("/tmp/draft-test-other/file.ts"), draftRoot),
    ).toBe(false);
  });
});
