import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureCheckoutRoute,
  enforceTailwindDirectivesAtTop,
  reassertComingSoonRoutes,
  restoreCheckoutRoute,
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

    // Simulate the model writing full pages into the four non-authored commerce
    // routes mid-init (the exact behavior the reassert exists to undo). Checkout
    // is NOT in this list: it is authored at init and frozen via capture/restore,
    // so reassertComingSoonRoutes must never revert it.
    const overwritten = [
      "src/routes/products/index.tsx",
      "src/routes/cart.tsx",
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

  it("leaves home, product-detail and checkout untouched", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });

    // The three routes init actually authors — the coming-soon reassert must
    // never touch them. Checkout is authored at init then frozen separately via
    // capture/restore, so it is not a coming-soon route.
    const home = "// model-authored homepage\nexport function Home() {}\n";
    const detail = "// model-authored product detail\nexport function Detail() {}\n";
    const checkout = "// model-authored checkout\nexport function Checkout() {}\n";
    await write("src/routes/index.tsx", home);
    await write("src/routes/products/$productId.tsx", detail);
    await write("src/routes/checkout.tsx", checkout);

    const reverted = await reassertComingSoonRoutes({ draftWorkspacePath: workspace });
    expect(reverted).not.toContain("src/routes/index.tsx");
    expect(reverted).not.toContain("src/routes/products/$productId.tsx");
    expect(reverted).not.toContain("src/routes/checkout.tsx");

    await expect(read("src/routes/index.tsx")).resolves.toBe(home);
    await expect(read("src/routes/products/$productId.tsx")).resolves.toBe(detail);
    await expect(read("src/routes/checkout.tsx")).resolves.toBe(checkout);
  });

  it("is a no-op when the coming-soon routes still match the seed", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });
    await expect(
      reassertComingSoonRoutes({ draftWorkspacePath: workspace }),
    ).resolves.toEqual([]);
  });

  it("restores the captured init-authored checkout after a model edit", async () => {
    await seedInitSettingsFiles({ draftWorkspacePath: workspace });

    // Simulate the frozen, init-authored checkout page.
    const frozen = "// init-authored checkout with a shipping form\nexport const Route = {};\n";
    await write("src/routes/checkout.tsx", frozen);

    const captured = await captureCheckoutRoute({ draftWorkspacePath: workspace });
    expect(captured).toBe(frozen);

    // Model re-authors it on a later run (e.g. wiring the form to persist PII).
    await write("src/routes/checkout.tsx", "// leaky rewrite that persists orders\n");

    const restored = await restoreCheckoutRoute({
      draftWorkspacePath: workspace,
      capturedBody: captured,
    });
    expect(restored).toBe(true);
    await expect(read("src/routes/checkout.tsx")).resolves.toBe(frozen);
  });

  it("capture/restore is a no-op for a legacy project with no checkout file", async () => {
    // A project predating the seed has no checkout.tsx — capture returns null
    // and restore does nothing rather than creating a spurious file.
    const captured = await captureCheckoutRoute({ draftWorkspacePath: workspace });
    expect(captured).toBeNull();

    const restored = await restoreCheckoutRoute({
      draftWorkspacePath: workspace,
      capturedBody: captured,
    });
    expect(restored).toBe(false);
    await expect(read("src/routes/checkout.tsx")).rejects.toThrow();
  });
});
