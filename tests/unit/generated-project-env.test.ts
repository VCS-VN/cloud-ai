import { describe, expect, it } from "vitest";
import {
  applyGeneratedProjectEnv,
  renderGeneratedProjectEnv,
} from "@/features/ai-agent/store-runtime/generated-project-env";
import { GeneratedProjectEnvWriter } from "@/features/ai-agent/store-runtime/generated-project-env-writer.server";

describe("generated project .env", () => {
  it("renders the default app-builder owned env file", () => {
    expect(renderGeneratedProjectEnv(null)).toBe(
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud\nVITE_STORE_SLUG=\n",
    );
  });

  it("upserts default API base URL and selected store slug", () => {
    expect(applyGeneratedProjectEnv("OTHER=value\nVITE_STORE_SLUG=old\n", "store-a")).toBe(
      "OTHER=value\nVITE_STORE_SLUG=store-a\nVITE_API_BASE_URL=https://customer-api.myepis.cloud\n",
    );
  });

  it("keeps VITE_STORE_SLUG as a blank value when no store is selected", () => {
    expect(
      applyGeneratedProjectEnv(
        "VITE_API_BASE_URL=https://wrong.example\nVITE_STORE_SLUG=store-a\n",
        null,
      ),
    ).toBe("VITE_API_BASE_URL=https://customer-api.myepis.cloud\nVITE_STORE_SLUG=\n");
  });
});

describe("GeneratedProjectEnvWriter", () => {
  it("creates .env when syncing a selected store and the file is missing", async () => {
    const store = new InMemoryProjectFileStore();
    const writer = new GeneratedProjectEnvWriter(store as never);

    await writer.syncStoreSlug("project-1", "store-a");

    expect(store.files.get("project-1")).toBe(
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud\nVITE_STORE_SLUG=store-a\n",
    );
  });

  it("creates default .env during project initialization", async () => {
    const store = new InMemoryProjectFileStore();
    const writer = new GeneratedProjectEnvWriter(store as never);

    await writer.ensureDefaultEnv("project-1");

    expect(store.files.get("project-1")).toBe(
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud\nVITE_STORE_SLUG=\n",
    );
  });
});

class InMemoryProjectFileStore {
  readonly files = new Map<string, string>();

  async readManagedEnvFile(projectId: string) {
    const content = this.files.get(projectId);
    if (content === undefined) {
      const error = new Error("missing") as Error & { code: string };
      error.code = "ENOENT";
      throw error;
    }
    return content;
  }

  async writeManagedEnvFile(projectId: string, content: string) {
    this.files.set(projectId, content);
  }
}
