import type { ProjectFileStore } from "@/features/projects/legacy/project-file-store.server";
import type { FileOperation } from "@/features/projects/legacy/project-state.schema";
import { PathGuard } from "@/features/ai-agent/security/path-guard.server";

export class PatchService {
  constructor(private readonly fileStore: Pick<ProjectFileStore, "writeTextFile" | "deleteFile">, private readonly pathGuard = new PathGuard()) {}

  async apply(projectId: string, operations: FileOperation[], options: { allowWrites?: boolean; blockedReason?: string } = {}) {
    if (options.allowWrites === false && operations.length > 0) {
      throw new Error(options.blockedReason ?? "Source writes are blocked until high-risk changes are confirmed.");
    }

    const changedFiles: string[] = [];
    for (const operation of operations) {
      this.pathGuard.assertSafeRelativePath(operation.path);
      if (operation.type === "delete_file") {
        await this.fileStore.deleteFile(projectId, operation.path);
      } else {
        await this.fileStore.writeTextFile(projectId, operation.path, operation.content);
      }
      changedFiles.push(operation.path);
    }
    return { changedFiles };
  }
}
