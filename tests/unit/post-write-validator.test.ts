import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  validateWrittenFiles,
  formatIssuesForRepairPrompt,
} from "@/features/agents/codex/runtime/post-write-validator.server";

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "post-write-validator-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
  return dir;
}

describe("validateWrittenFiles", () => {
  it("flags hardcoded brand strings", async () => {
    const dir = await fixture({
      "src/components/layout/site-header.tsx": `
        export function SiteHeader() {
          return <header><h1>AI Storefront</h1></header>;
        }
      `,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/components/layout/site-header.tsx"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("brand_name_hardcoded");
    expect(issues[0]?.line).toBeGreaterThan(0);
  });

  it("passes a clean file that uses storeDetail.name", async () => {
    const dir = await fixture({
      "src/components/layout/site-header.tsx": `
        export function SiteHeader() {
          const { storeDetail } = useStore();
          return <header><h1>{storeDetail?.name}</h1></header>;
        }
      `,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/components/layout/site-header.tsx"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues).toEqual([]);
  });

  it("flags lucide brand icon imports", async () => {
    const dir = await fixture({
      "src/components/layout/site-footer.tsx": `
        import { Mail, Instagram, Facebook } from "lucide-react";
        export function SiteFooter() { return <footer/>; }
      `,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/components/layout/site-footer.tsx"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    const codes = issues.map((i) => i.code);
    expect(codes).toEqual([
      "lucide_brand_icon_imported",
      "lucide_brand_icon_imported",
    ]);
    expect(issues.map((i) => i.evidence)).toEqual(["Instagram", "Facebook"]);
  });

  it("does NOT flag generic lucide icons", async () => {
    const dir = await fixture({
      "src/components/layout/site-header.tsx": `
        import { ShoppingCart, Search, Heart, Mail } from "lucide-react";
      `,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/components/layout/site-header.tsx"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues).toEqual([]);
  });

  it("flags @apply group misuse in CSS", async () => {
    const dir = await fixture({
      "src/styles/app.css": `
        @tailwind base;
        .card { @apply rounded-lg group-hover:shadow-md; }
        .row { @apply group; }
      `,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/styles/app.css"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.code === "tailwind_apply_group_misuse")).toBe(true);
  });

  it("flags direct @/data import in routes and components", async () => {
    const dir = await fixture({
      "src/routes/index.tsx": `import { products } from "@/data/products";`,
      "src/components/store/product-grid.tsx": `import { categories } from "@/data/categories";`,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: [
        "src/routes/index.tsx",
        "src/components/store/product-grid.tsx",
      ],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues.map((i) => i.code)).toEqual([
      "direct_data_import_in_ui",
      "direct_data_import_in_ui",
    ]);
  });

  it("allows hook implementations to import @/data", async () => {
    const dir = await fixture({
      "src/services/store/use-products-list.ts": `import { products } from "@/data/products";`,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/services/store/use-products-list.ts"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues).toEqual([]);
  });

  it("ignores files outside agent-owned paths", async () => {
    const dir = await fixture({
      "src/app/providers.tsx": `<h1>AI Storefront</h1>`,
    });
    const issues = await validateWrittenFiles({
      draftWorkspacePath: dir,
      filePaths: ["src/app/providers.tsx"],
    });
    await fs.rm(dir, { recursive: true, force: true });
    expect(issues).toEqual([]);
  });

  it("formatIssuesForRepairPrompt groups by code", () => {
    const out = formatIssuesForRepairPrompt([
      {
        code: "brand_name_hardcoded",
        path: "src/routes/index.tsx",
        line: 12,
        message: "Hardcoded brand",
        evidence: "AI Storefront",
      },
      {
        code: "brand_name_hardcoded",
        path: "src/components/layout/site-footer.tsx",
        line: 3,
        message: "Hardcoded brand",
        evidence: "Demo Store",
      },
      {
        code: "lucide_brand_icon_imported",
        path: "src/components/layout/site-footer.tsx",
        line: 1,
        message: "Bad icon",
        evidence: "Instagram",
      },
    ]);
    expect(out).toContain("[brand_name_hardcoded]");
    expect(out).toContain("src/routes/index.tsx:12");
    expect(out).toContain("[lucide_brand_icon_imported]");
  });
});
