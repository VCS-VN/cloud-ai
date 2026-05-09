import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_TOOL_LIMITS } from "../code-tool-registry.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "./project-patch-service.server";

describe("ProjectPatchService policy", () => {
  const service = new ProjectPatchService();

  it("blocks forbidden paths", () => {
    expect(() => service.validatePatch({ patch: "--- a/.env\n+++ b/.env\n@@\n+SECRET=value" })).toThrow(ProjectPatchPolicyError);
  });

  it("blocks protected generated files", () => {
    expect(() => service.validatePatch({ patch: "--- a/package-lock.json\n+++ b/package-lock.json\n@@\n+{}" })).toThrow(/protected/);
  });

  it("blocks package policy changes", () => {
    expect(() => service.validatePatch({ patch: "--- a/package.json\n+++ b/package.json\n@@\n+{}" })).toThrow(/Package changes/);
  });

  it("blocks oversized patches and too many changed files", () => {
    expect(() => service.validatePatch({ patch: `--- a/src/a.ts\n+++ b/src/a.ts\n@@\n+${"x".repeat(CODE_TOOL_LIMITS.maxPatchBytes)}` })).toThrow(/size/);
    const patch = Array.from({ length: CODE_TOOL_LIMITS.maxFilesChangedWithoutReview + 1 }, (_, index) => `--- a/src/${index}.ts\n+++ b/src/${index}.ts\n@@\n+ok`).join("\n");
    expect(() => service.validatePatch({ patch })).toThrow(/too many/i);
  });

  it("applies a small unified patch and reports metrics", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "patch-service-"));
    await writeFile(path.join(workspaceRoot, "app.ts"), "const title = 'Old'\n", "utf8");
    const result = await service.applyPatch({ workspaceRoot, patch: "--- a/app.ts\n+++ b/app.ts\n@@\n-const title = 'Old'\n+const title = 'New'\n", expectedChangedFiles: ["app.ts"] });
    await expect(readFile(path.join(workspaceRoot, "app.ts"), "utf8")).resolves.toBe("const title = 'New'\n");
    expect(result).toMatchObject({ changedFiles: ["app.ts"], modifiedFiles: ["app.ts"], insertions: 1, deletions: 1 });
  });
});
