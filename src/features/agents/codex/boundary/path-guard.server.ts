import path from "node:path";

export type PathGuardContext = {
  projectId: string;
  userId: string | undefined;
  draftWorkspacePath: string;
};

export type PathGuardResult =
  | { ok: true; absolutePath: string; relativePath: string }
  | { ok: false; reason: string };

function normalize(p: string): string {
  return path.resolve(p);
}

export function isInsideDraft(absPath: string, draftRoot: string): boolean {
  const root = normalize(draftRoot);
  const target = normalize(absPath);
  if (target === root) return true;
  return target.startsWith(root + path.sep);
}

export function checkPath(
  ctx: PathGuardContext,
  candidatePath: string,
): PathGuardResult {
  if (!ctx.draftWorkspacePath) {
    return { ok: false, reason: "missing_draft_workspace" };
  }
  if (!ctx.projectId) {
    return { ok: false, reason: "missing_project_id" };
  }
  const draftRoot = normalize(ctx.draftWorkspacePath);

  if (!path.isAbsolute(candidatePath) && candidatePath.includes("..")) {
    const resolved = path.resolve(draftRoot, candidatePath);
    if (!isInsideDraft(resolved, draftRoot)) {
      return { ok: false, reason: "path_traversal_outside_draft" };
    }
  }

  const abs = path.isAbsolute(candidatePath)
    ? normalize(candidatePath)
    : path.resolve(draftRoot, candidatePath);

  if (!isInsideDraft(abs, draftRoot)) {
    return { ok: false, reason: "outside_draft_workspace" };
  }

  const rel = path.relative(draftRoot, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, reason: "outside_draft_workspace" };
  }

  return { ok: true, absolutePath: abs, relativePath: rel };
}

export function assertSameContext(
  current: PathGuardContext,
  expected: PathGuardContext,
): { ok: boolean; reason?: string } {
  if (current.projectId !== expected.projectId) {
    return { ok: false, reason: "project_id_mismatch" };
  }
  if ((current.userId ?? null) !== (expected.userId ?? null)) {
    return { ok: false, reason: "user_id_mismatch" };
  }
  if (
    normalize(current.draftWorkspacePath) !==
    normalize(expected.draftWorkspacePath)
  ) {
    return { ok: false, reason: "draft_path_mismatch" };
  }
  return { ok: true };
}
