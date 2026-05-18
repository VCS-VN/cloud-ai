import { describe, expect, it, vi } from "vitest";
import {
  GeneratedProjectEnvWriter,
  applyStoreSlugToEnv,
} from "../generated-project-env-writer.server";

describe("applyStoreSlugToEnv", () => {
  it("updates existing VITE_STORE_SLUG and preserves unrelated lines", () => {
    const input = [
      "# infra base",
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud",
      "",
      "VITE_STORE_SLUG=old-slug",
      "VITE_FEATURE_FLAG=on",
      "",
    ].join("\n");
    const output = applyStoreSlugToEnv(input, "new-slug");
    expect(output).toBe(
      [
        "# infra base",
        "VITE_API_BASE_URL=https://customer-api.myepis.cloud",
        "",
        "VITE_STORE_SLUG=new-slug",
        "VITE_FEATURE_FLAG=on",
        "",
      ].join("\n"),
    );
  });

  it("appends VITE_STORE_SLUG when missing and preserves trailing newline", () => {
    const input = "VITE_API_BASE_URL=https://customer-api.myepis.cloud\n";
    const output = applyStoreSlugToEnv(input, "alpha");
    expect(output).toBe(
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud\nVITE_STORE_SLUG=alpha\n",
    );
  });

  it("appends and adds trailing newline when input had none", () => {
    const input = "VITE_API_BASE_URL=https://customer-api.myepis.cloud";
    const output = applyStoreSlugToEnv(input, "alpha");
    expect(output).toBe(
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud\nVITE_STORE_SLUG=alpha\n",
    );
  });

  it("removes the line when slug is null and key exists", () => {
    const input = [
      "VITE_API_BASE_URL=https://customer-api.myepis.cloud",
      "VITE_STORE_SLUG=stale",
      "VITE_FEATURE_FLAG=on",
      "",
    ].join("\n");
    const output = applyStoreSlugToEnv(input, null);
    expect(output).toBe(
      [
        "VITE_API_BASE_URL=https://customer-api.myepis.cloud",
        "VITE_FEATURE_FLAG=on",
        "",
      ].join("\n"),
    );
  });

  it("returns input unchanged when slug is null and key missing", () => {
    const input = "VITE_API_BASE_URL=https://customer-api.myepis.cloud\n";
    expect(applyStoreSlugToEnv(input, null)).toBe(input);
  });

  it("returns input unchanged when key already matches the new slug", () => {
    const input = "VITE_STORE_SLUG=alpha\n";
    expect(applyStoreSlugToEnv(input, "alpha")).toBe(input);
  });

  it("is idempotent across two applications", () => {
    const input = "VITE_API_BASE_URL=https://example\nVITE_STORE_SLUG=old\n";
    const once = applyStoreSlugToEnv(input, "fresh");
    const twice = applyStoreSlugToEnv(once, "fresh");
    expect(twice).toBe(once);
  });

  it("seeds an empty file with the slug", () => {
    expect(applyStoreSlugToEnv("", "alpha")).toBe("VITE_STORE_SLUG=alpha\n");
  });

  it("leaves an empty file empty when slug is null", () => {
    expect(applyStoreSlugToEnv("", null)).toBe("");
  });
});

describe("GeneratedProjectEnvWriter", () => {
  function createFakeStore(initial: { content?: string; readError?: NodeJS.ErrnoException }) {
    const writeTextFile = vi.fn(async () => {});
    const readTextFile = vi.fn(async () => {
      if (initial.readError) throw initial.readError;
      return initial.content ?? "";
    });
    return {
      store: { readTextFile, writeTextFile } as never,
      readTextFile,
      writeTextFile,
    };
  }

  it("no-ops when .env does not exist", async () => {
    const enoent = Object.assign(new Error("not found"), { code: "ENOENT" });
    const { store, writeTextFile } = createFakeStore({ readError: enoent });
    const writer = new GeneratedProjectEnvWriter(store);
    await expect(writer.syncStoreSlug("project-1", "alpha")).resolves.toBeUndefined();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("does not write when content is unchanged", async () => {
    const { store, writeTextFile } = createFakeStore({ content: "VITE_STORE_SLUG=alpha\n" });
    const writer = new GeneratedProjectEnvWriter(store);
    await writer.syncStoreSlug("project-1", "alpha");
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("writes the updated content when slug changes", async () => {
    const { store, writeTextFile } = createFakeStore({
      content: "VITE_API_BASE_URL=https://example\nVITE_STORE_SLUG=old\n",
    });
    const writer = new GeneratedProjectEnvWriter(store);
    await writer.syncStoreSlug("project-1", "fresh");
    expect(writeTextFile).toHaveBeenCalledWith(
      "project-1",
      ".env",
      "VITE_API_BASE_URL=https://example\nVITE_STORE_SLUG=fresh\n",
    );
  });

  it("rethrows non-ENOENT read errors", async () => {
    const fatal = Object.assign(new Error("permission denied"), { code: "EACCES" });
    const { store } = createFakeStore({ readError: fatal });
    const writer = new GeneratedProjectEnvWriter(store);
    await expect(writer.syncStoreSlug("project-1", "alpha")).rejects.toThrow("permission denied");
  });
});
