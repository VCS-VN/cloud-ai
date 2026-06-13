import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { rescueShellExpandedBatchFiles } from "@/features/agents/codex/runtime/builder-run.server";

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "rescue-test-"));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

async function write(rel: string, body = "x") {
  const abs = path.join(workspace, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body, "utf8");
}

async function exists(rel: string) {
  try {
    await fs.access(path.join(workspace, rel));
    return true;
  } catch {
    return false;
  }
}

describe("rescueShellExpandedBatchFiles", () => {
  it("renames the shell-expanded artifact back to the intended $param path", async () => {
    // bash expanded `$productId` to empty -> file landed at products/.tsx
    await write("src/routes/products/.tsx", "route body");

    const rescued = await rescueShellExpandedBatchFiles(workspace, [
      "src/routes/products/$productId.tsx",
    ]);

    expect(rescued).toEqual(["src/routes/products/$productId.tsx"]);
    expect(await exists("src/routes/products/$productId.tsx")).toBe(true);
    expect(await exists("src/routes/products/.tsx")).toBe(false);
    expect(
      await fs.readFile(
        path.join(workspace, "src/routes/products/$productId.tsx"),
        "utf8",
      ),
    ).toBe("route body");
  });

  it("rescues ${param} brace form too", async () => {
    await write("src/routes/orders/.tsx", "order body");
    const rescued = await rescueShellExpandedBatchFiles(workspace, [
      "src/routes/orders/${orderId}.tsx",
    ]);
    expect(rescued).toEqual(["src/routes/orders/${orderId}.tsx"]);
    expect(await exists("src/routes/orders/${orderId}.tsx")).toBe(true);
  });

  it("does nothing when the intended file already exists", async () => {
    await write("src/routes/products/$productId.tsx", "correct");
    await write("src/routes/products/.tsx", "stray");

    const rescued = await rescueShellExpandedBatchFiles(workspace, [
      "src/routes/products/$productId.tsx",
    ]);

    expect(rescued).toEqual([]);
    // intended file untouched
    expect(
      await fs.readFile(
        path.join(workspace, "src/routes/products/$productId.tsx"),
        "utf8",
      ),
    ).toBe("correct");
  });

  it("does nothing when no expanded artifact exists (genuine miss)", async () => {
    const rescued = await rescueShellExpandedBatchFiles(workspace, [
      "src/routes/products/$productId.tsx",
    ]);
    expect(rescued).toEqual([]);
    expect(await exists("src/routes/products/$productId.tsx")).toBe(false);
  });

  it("ignores files without a $ in the path", async () => {
    await write("src/routes/index.tsx", "home");
    const rescued = await rescueShellExpandedBatchFiles(workspace, [
      "src/routes/index.tsx",
    ]);
    expect(rescued).toEqual([]);
  });
});
