import fs from "node:fs/promises";
import path from "node:path";
import { isInsideDraft } from "./path-guard.server";

export type SymlinkScanIssue = {
  path: string;
  target: string;
  reason: "symlink_outside_draft" | "symlink_dangling" | "symlink_cycle";
};

export type SymlinkScanResult = {
  ok: boolean;
  issues: SymlinkScanIssue[];
};

const MAX_SYMLINK_HOPS = 10;

async function resolveSymlinkChain(
  symlinkPath: string,
  draftRoot: string,
): Promise<{ status: "ok" | "outside" | "dangling" | "cycle"; target: string }> {
  let current = symlinkPath;
  const visited = new Set<string>();
  for (let i = 0; i < MAX_SYMLINK_HOPS; i++) {
    if (visited.has(current)) {
      return { status: "cycle", target: current };
    }
    visited.add(current);
    let stat: { isSymbolicLink(): boolean };
    try {
      stat = await fs.lstat(current);
    } catch {
      return { status: "dangling", target: current };
    }
    if (!stat.isSymbolicLink()) {
      return {
        status: isInsideDraft(current, draftRoot) ? "ok" : "outside",
        target: current,
      };
    }
    let linkTarget: string;
    try {
      linkTarget = await fs.readlink(current);
    } catch {
      return { status: "dangling", target: current };
    }
    current = path.isAbsolute(linkTarget)
      ? linkTarget
      : path.resolve(path.dirname(current), linkTarget);
  }
  return { status: "cycle", target: current };
}

async function walk(
  dir: string,
  draftRoot: string,
  out: SymlinkScanIssue[],
): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const result = await resolveSymlinkChain(full, draftRoot);
      if (result.status === "outside") {
        out.push({ path: full, target: result.target, reason: "symlink_outside_draft" });
      } else if (result.status === "dangling") {
        out.push({ path: full, target: result.target, reason: "symlink_dangling" });
      } else if (result.status === "cycle") {
        out.push({ path: full, target: result.target, reason: "symlink_cycle" });
      }
      continue;
    }
    if (entry.isDirectory()) {
      await walk(full, draftRoot, out);
    }
  }
}

export async function scanDraftForSymlinks(
  draftWorkspacePath: string,
): Promise<SymlinkScanResult> {
  const root = path.resolve(draftWorkspacePath);
  const issues: SymlinkScanIssue[] = [];
  await walk(root, root, issues);
  return { ok: issues.length === 0, issues };
}
