import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectSnapshotService } from "./project-snapshot-service.server";

describe("ProjectSnapshotService", () => {
  it("creates and rolls back a workspace snapshot for the current message", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "snapshot-service-"));
    const filePath = path.join(workspaceRoot, "src/app.ts");
    await writeFile(filePath, "before", "utf8");
    const service = new ProjectSnapshotService();

    const snapshot = await service.createSnapshot({ workspaceRoot, projectId: "project_1", messageId: "msg_1", reason: "before edit" });
    await writeFile(filePath, "after", "utf8");
    await service.rollbackSnapshot({ workspaceRoot, projectId: "project_1", messageId: "msg_1", snapshot, reason: "undo" });

    await expect(readFile(filePath, "utf8")).resolves.toBe("before");
  });

  it("blocks rollback across messages", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "snapshot-service-"));
    await writeFile(path.join(workspaceRoot, "app.ts"), "before", "utf8");
    const service = new ProjectSnapshotService();
    const snapshot = await service.createSnapshot({ workspaceRoot, projectId: "project_1", messageId: "msg_1", reason: "before edit" });

    await expect(service.rollbackSnapshot({ workspaceRoot, projectId: "project_1", messageId: "msg_2", snapshot, reason: "bad" })).rejects.toThrow(/current message/);
  });
});
