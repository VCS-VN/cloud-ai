import { describe, it, expect } from "vitest";
import { runDiffGate } from "@/features/agents/codex/boundary/diff-gate.server";
import type { SnapshotDiff } from "@/features/agents/codex/boundary/filesystem-audit.server";

const DRAFT = "/tmp/draft-test";

function diff(parts: Partial<SnapshotDiff>): SnapshotDiff {
  return {
    added: parts.added ?? [],
    modified: parts.modified ?? [],
    removed: parts.removed ?? [],
  };
}

describe("runDiffGate", () => {
  it("passes when all changes are inside src/components/**", () => {
    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({
        added: ["src/components/Button.tsx"],
        modified: ["src/components/Card.tsx"],
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("blocks changes to package.json with blocked_path violation", () => {
    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({ modified: ["package.json"] }),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      path: "package.json",
      reason: "blocked_path",
      matchedRule: "package.json",
    });
  });

  it("blocks .env.production via regex pattern", () => {
    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({ added: [".env.production"] }),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.reason).toBe("blocked_path");
    expect(result.violations[0]?.path).toBe(".env.production");
  });

  it("allows changes to src/routes/index.tsx (allowed-with-audit)", () => {
    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({ modified: ["src/routes/index.tsx"] }),
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("blocks src/routes/__root.tsx", () => {
    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({ modified: ["src/routes/__root.tsx"] }),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.reason).toBe("blocked_path");
  });

  it("flags absolute paths outside the draft workspace", () => {
    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({ added: ["/etc/passwd"] }),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      path: "/etc/passwd",
      reason: "outside_draft_workspace",
    });
  });

  it("returns changedFiles in order: added, modified, removed", () => {
    const added = ["src/components/A.tsx", "src/components/B.tsx"];
    const modified = ["src/components/C.tsx"];
    const removed = ["src/components/D.tsx"];

    const result = runDiffGate({
      draftWorkspacePath: DRAFT,
      diff: diff({ added, modified, removed }),
    });

    expect(result.changedFiles).toEqual([...added, ...modified, ...removed]);
  });
});
