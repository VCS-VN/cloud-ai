import path from "node:path";
import { isInsideDraft } from "./path-guard.server";
import { classifyProjectPath } from "./protected-paths";
import type { SnapshotDiff } from "./filesystem-audit.server";

export type DiffGateInput = {
  draftWorkspacePath: string;
  diff: SnapshotDiff;
};

export type DiffGateViolation = {
  path: string;
  reason:
    | "outside_draft_workspace"
    | "blocked_path"
    | "path_traversal";
  matchedRule?: string;
};

export type DiffGateResult = {
  ok: boolean;
  violations: DiffGateViolation[];
  changedFiles: string[];
};

export function runDiffGate(input: DiffGateInput): DiffGateResult {
  const violations: DiffGateViolation[] = [];
  const root = path.resolve(input.draftWorkspacePath);
  const changedFiles = [
    ...input.diff.added,
    ...input.diff.modified,
    ...input.diff.removed,
  ];

  for (const rel of changedFiles) {
    const abs = path.resolve(root, rel);
    if (!isInsideDraft(abs, root)) {
      violations.push({ path: rel, reason: "outside_draft_workspace" });
      continue;
    }
    const verdict = classifyProjectPath(rel);
    if (verdict.kind === "blocked") {
      violations.push({
        path: rel,
        reason: "blocked_path",
        matchedRule: verdict.matchedRule,
      });
    }
  }

  return { ok: violations.length === 0, violations, changedFiles };
}
