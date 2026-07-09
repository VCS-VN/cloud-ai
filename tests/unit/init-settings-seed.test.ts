import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  enforceTailwindDirectivesAtTop,
  reassertComingSoonRoutes,
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

  it("reverts model-authored commerce routes to their coming-soon seed", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });

    // Simulate the model writing full pages into the five non-authored commerce
    // routes mid-init (the exact behavior the reassert exists to undo).
    const overwritten = [
      "src/routes/products/index.tsx",
      "src/routes/cart.tsx",
      "src/routes/checkout.tsx",
      "src/routes/orders.tsx",
      "src/routes/orders/$orderId.tsx",
    ];
    for (const rel of overwritten) {
      await write(rel, "// full page authored by the model\nexport const Route = {};\n");
    }

    const reverted = await reassertComingSoonRoutes({ draftWorkspacePath: workspace });
    expect(reverted.sort()).toEqual(overwritten.slice().sort());

    for (const rel of overwritten) {
      await expect(read(rel)).resolves.toContain("This page is coming soon.");
    }
  });

  it("leaves home and product-detail untouched", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });

    // The two routes init actually authors — the reassert must never touch them.
    const home = "// model-authored homepage\nexport function Home() {}\n";
    const detail = "// model-authored product detail\nexport function Detail() {}\n";
    await write("src/routes/index.tsx", home);
    await write("src/routes/products/$productId.tsx", detail);

    const reverted = await reassertComingSoonRoutes({ draftWorkspacePath: workspace });
    expect(reverted).not.toContain("src/routes/index.tsx");
    expect(reverted).not.toContain("src/routes/products/$productId.tsx");

    await expect(read("src/routes/index.tsx")).resolves.toBe(home);
    await expect(read("src/routes/products/$productId.tsx")).resolves.toBe(detail);
  });

  it("is a no-op when the coming-soon routes still match the seed", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });
    await expect(
      reassertComingSoonRoutes({ draftWorkspacePath: workspace }),
    ).resolves.toEqual([]);
  });
});
