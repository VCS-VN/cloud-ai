import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  enforceTailwindDirectivesAtTop,
  seedInitSettingsFiles,
} from "@/features/agents/codex/runtime/init-settings-seed.server";

let workspace: string;

async function write(rel: string, body: string): Promise<void> {
  const abs = path.join(workspace, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body, "utf8");
}

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(workspace, rel), "utf8");
}

describe("init-settings-seed", () => {
  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), "init-settings-seed-"));
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it("keeps app.css Tailwind directives as the first three lines", async () => {
    await write(
      "src/styles/app.css",
      [
        "/* generated note */",
        "@tailwind utilities;",
        "",
        ".hero { color: red; }",
        "@tailwind base;",
        "@tailwind components;",
        "",
      ].join("\n"),
    );

    await expect(enforceTailwindDirectivesAtTop({ draftWorkspacePath: workspace })).resolves.toBe(
      true,
    );

    const css = await read("src/styles/app.css");
    expect(css.split(/\r?\n/).slice(0, 3)).toEqual([
      "@tailwind base;",
      "@tailwind components;",
      "@tailwind utilities;",
    ]);
    expect(css).toContain("/* generated note */");
    expect(css.match(/@tailwind/g)).toHaveLength(3);
  });

  it("seeds required commerce route skeletons and canonical app.css", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });

    await expect(read("src/routes/index.tsx")).resolves.toContain("createFileRoute");
    await expect(read("src/routes/products/index.tsx")).resolves.toContain("ProductsPage");
    await expect(read("src/routes/products/$productId.tsx")).resolves.toContain(
      "ProductDetailPage",
    );
    await expect(read("src/routes/cart.tsx")).resolves.toContain("CartPage");
    await expect(read("src/routes/checkout.tsx")).resolves.toContain("CheckoutPage");
    await expect(read("src/routes/orders.tsx")).resolves.toContain("OrdersPage");
    await expect(read("src/routes/orders/$orderId.tsx")).resolves.toContain("OrderDetailPage");

    const appCss = await read("src/styles/app.css");
    expect(appCss.split(/\r?\n/).slice(0, 3)).toEqual([
      "@tailwind base;",
      "@tailwind components;",
      "@tailwind utilities;",
    ]);
  });
});
