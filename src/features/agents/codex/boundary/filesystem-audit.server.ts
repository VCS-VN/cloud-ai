import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type FilesystemSnapshot = {
  draftWorkspacePath: string;
  takenAt: number;
  entries: Record<string, { size: number; sha256: string }>;
};

export type SnapshotDiff = {
  added: string[];
  removed: string[];
  modified: string[];
};

async function hashFile(absPath: string): Promise<string> {
  const data = await fs.readFile(absPath);
  return createHash("sha256").update(data).digest("hex");
}

async function walk(
  dir: string,
  root: string,
  out: Record<string, { size: number; sha256: string }>,
): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await walk(full, root, out);
      continue;
    }
    if (entry.isFile()) {
      const rel = path.relative(root, full);
      const stat = await fs.stat(full);
      const sha256 = await hashFile(full);
      out[rel] = { size: stat.size, sha256 };
    }
  }
}

export async function takeSnapshot(
  draftWorkspacePath: string,
): Promise<FilesystemSnapshot> {
  const root = path.resolve(draftWorkspacePath);
  const entries: Record<string, { size: number; sha256: string }> = {};
  await walk(root, root, entries);
  return { draftWorkspacePath: root, takenAt: Date.now(), entries };
}

export function diffSnapshots(
  before: FilesystemSnapshot,
  after: FilesystemSnapshot,
): SnapshotDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const beforeKeys = new Set(Object.keys(before.entries));
  const afterKeys = new Set(Object.keys(after.entries));
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      added.push(key);
      continue;
    }
    if (before.entries[key].sha256 !== after.entries[key].sha256) {
      modified.push(key);
    }
  }
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) removed.push(key);
  }
  return { added, removed, modified };
}
