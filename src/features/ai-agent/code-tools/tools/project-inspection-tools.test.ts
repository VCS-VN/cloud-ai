/** @vitest-environment node */
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "../code-agent-types";
import { projectGetContextTool } from "./project-get-context.tool.server";
import { projectGetFileTreeTool } from "./project-get-file-tree.tool.server";
import { projectReadFileRangeTool } from "./project-read-file-range.tool.server";
import { projectReadFileTool } from "./project-read-file.tool.server";
import { projectSearchCodeTool } from "./project-search-code.tool.server";

let workspaceRoot: string;

const projectState = {
  projectId: "project-1",
  status: "initialized",
  stack: { framework: "tanstack-start", router: "tanstack-router", serverState: "tanstack-query", ui: "react", styling: "tailwindcss", bundler: "vite", viteVersion: "8", language: "typescript", packageManager: "pnpm", packageProfileId: "default" },
  packagePolicy: { registryVersion: "1", initializedPackages: [{ name: "react", version: "19.0.0", installType: "dependencies" }] },
  ecommerceSpec: { storeType: "fashion", targetCustomers: [], productCategories: [], mainProducts: [], requiredFeatures: [] },
  brand: { name: "Demo", tone: "minimal", colors: { primary: "#000" } },
  pages: [],
  features: { productListing: true, productDetail: false, cart: false, cartDrawer: false, checkout: false, productSearch: false, productFilter: false, wishlist: false, reviews: false, promotions: false, newsletter: false, auth: false, adminDashboard: false, paymentIntegration: "none" },
  constraints: { doNotChange: [], preferredComponents: [], forbiddenLibraries: [], notes: [] },
  fileManifest: [{ path: "src/components/ProductCard.tsx", kind: "component", purpose: "Product card", symbols: ["ProductCard"] }],
  decisionLog: [],
  recentChanges: [],
} satisfies ToolExecutionContext["projectState"];

function context(): ToolExecutionContext {
  return { userId: "user-1", projectId: "project-1", messageId: "message-1", workspaceRoot, projectState };
}

describe("project inspection tools", () => {
  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "code-tools-"));
    await mkdir(join(workspaceRoot, "src/components"), { recursive: true });
    await writeFile(join(workspaceRoot, "src/components/ProductCard.tsx"), "export function ProductCard() {\n  const apiKey = 'sk-test-secret';\n  return <div>Product</div>;\n}\n");
    await writeFile(join(workspaceRoot, ".env"), "SECRET=hidden");
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("returns trusted project context", async () => {
    const result = await projectGetContextTool.handler({ context: context(), args: { includePackagePolicy: true } });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ projectId: "project-1", summary: expect.any(String) });
  });

  it("lists safe file tree without forbidden files", async () => {
    const result = await projectGetFileTreeTool.handler({ context: context(), args: { root: "", maxDepth: 4 } });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.data)).toContain("src/components/ProductCard.tsx");
    expect(JSON.stringify(result.data)).not.toContain(".env");
  });

  it("searches code with redacted snippets", async () => {
    const result = await projectSearchCodeTool.handler({ context: context(), args: { query: "ProductCard", globs: ["src/**/*.tsx"], maxResults: 5 } });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.data)).toContain("ProductCard");
    expect(JSON.stringify(result.data)).not.toContain("sk-test-secret");
  });

  it("reads files and ranges safely", async () => {
    const full = await projectReadFileTool.handler({ context: context(), args: { path: "src/components/ProductCard.tsx", maxBytes: 10000 } });
    const range = await projectReadFileRangeTool.handler({ context: context(), args: { path: "src/components/ProductCard.tsx", startLine: 1, endLine: 2 } });
    expect(full.ok).toBe(true);
    expect(range.ok).toBe(true);
    expect(JSON.stringify(full.data)).not.toContain("sk-test-secret");
    expect(JSON.stringify(range.data)).not.toContain("sk-test-secret");
  });

  it("blocks unsafe reads", async () => {
    const result = await projectReadFileTool.handler({ context: context(), args: { path: ".env" } });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("FORBIDDEN_PROJECT_PATH");
  });
});
