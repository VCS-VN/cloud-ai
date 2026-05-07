import { describe, expect, it } from "vitest";
import { ProjectWorkspaceService } from "@/agent/project-workspace-service";

describe("ProjectWorkspaceService", () => {
  it("rejects path traversal outside the workspace", () => {
    const service = new ProjectWorkspaceService();
    expect(() => service.resolveWorkspacePath("project_1", "../escape.txt")).toThrow(
      "escapes the project workspace",
    );
  });
});
