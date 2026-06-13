import type { ProjectFileStore } from "@/features/projects/legacy/project-file-store.server";
import { applyGeneratedProjectEnv, renderGeneratedProjectEnv } from "./generated-project-env";
export { applyGeneratedProjectEnv, applyStoreSlugToEnv, renderGeneratedProjectEnv } from "./generated-project-env";

export class GeneratedProjectEnvWriter {
  constructor(private readonly projectFileStore: ProjectFileStore) {}

  async ensureDefaultEnv(projectId: string, slug: string | null = null): Promise<void> {
    let content: string;
    try {
      content = await this.projectFileStore.readManagedEnvFile(projectId);
    } catch (err) {
      if (!isFileNotFoundError(err)) throw err;
      await this.projectFileStore.writeManagedEnvFile(projectId, renderGeneratedProjectEnv(slug));
      return;
    }

    const next = applyGeneratedProjectEnv(content, slug);
    if (next === content) return;
    await this.projectFileStore.writeManagedEnvFile(projectId, next);
  }

  async syncStoreSlug(projectId: string, slug: string | null): Promise<void> {
    let content: string;
    try {
      content = await this.projectFileStore.readManagedEnvFile(projectId);
    } catch (err) {
      if (!isFileNotFoundError(err)) throw err;
      await this.projectFileStore.writeManagedEnvFile(projectId, renderGeneratedProjectEnv(slug));
      return;
    }

    const next = applyGeneratedProjectEnv(content, slug);
    if (next === content) return;
    await this.projectFileStore.writeManagedEnvFile(projectId, next);
  }
}

function isFileNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT";
}
