import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectPatchPolicyError, ProjectPatchService } from "./project-patch-service.server";

const tempRoots: string[] = [];

async function createTempProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), "project-patch-service-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ProjectPatchService", () => {
  it("rejects patches with no file changes", async () => {
    const service = new ProjectPatchService();
    const workspaceRoot = await createTempProject();

    await expect(service.applyPatch({
      workspaceRoot,
      patch: "this is not a unified diff",
      expectedChangedFiles: [],
    })).rejects.toMatchObject({
      code: "PATCH_APPLY_FAILED",
    } satisfies Partial<ProjectPatchPolicyError>);
  });

  it("returns mutation records only for actual file writes", async () => {
    const service = new ProjectPatchService();
    const workspaceRoot = await createTempProject();
    await writeFile(path.join(workspaceRoot, "src.txt"), "hello\n", "utf8");

    const result = await service.applyPatch({
      workspaceRoot,
      expectedChangedFiles: ["src.txt"],
      patch: [
        "--- a/src.txt",
        "+++ b/src.txt",
        "@@",
        " hello",
        "+world",
      ].join("\n"),
    });

    await expect(readFile(path.join(workspaceRoot, "src.txt"), "utf8")).resolves.toBe("hello\nworld\n");
    expect(result.changedFiles).toEqual(["src.txt"]);
    expect(result.mutationRecords).toEqual([{
      path: "src.txt",
      operation: "modified",
      beforeBytes: 6,
      afterBytes: 12,
    }]);
  });

  it("rejects deleting files that are already absent", async () => {
    const service = new ProjectPatchService();
    const workspaceRoot = await createTempProject();

    await expect(service.deleteFile({
      workspaceRoot,
      relativePath: "missing.ts",
    })).rejects.toMatchObject({
      code: "PATCH_APPLY_FAILED",
    } satisfies Partial<ProjectPatchPolicyError>);
  });
});
