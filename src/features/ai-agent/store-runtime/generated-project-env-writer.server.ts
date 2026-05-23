import type { ProjectFileStore } from "../project/project-file-store.server";
import { applyStoreSlugToEnv } from "./generated-project-env";
export { applyStoreSlugToEnv } from "./generated-project-env";

export class GeneratedProjectEnvWriter {
  constructor(private readonly projectFileStore: ProjectFileStore) {}

  async syncStoreSlug(projectId: string, slug: string | null): Promise<void> {
    let content: string;
    try {
      content = await this.projectFileStore.readManagedEnvFile(projectId);
    } catch (err) {
      if (isFileNotFoundError(err)) return;
      throw err;
    }

    const next = applyStoreSlugToEnv(content, slug);
    if (next === content) return;
    await this.projectFileStore.writeManagedEnvFile(projectId, next);
  }
}

function isFileNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT";
}
