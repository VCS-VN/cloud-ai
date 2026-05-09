import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ProjectState } from "../project/project-state.schema";
import type { ToolExecutionContext } from "./code-agent-types";

export function createTestProjectState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    projectId: "project_test",
    status: "initialized",
    stack: {
      framework: "tanstack-start",
      router: "tanstack-router",
      serverState: "tanstack-query",
      ui: "react",
      styling: "tailwindcss",
      bundler: "vite",
      viteVersion: "8",
      language: "typescript",
      packageManager: "pnpm",
      packageProfileId: "default",
    },
    packagePolicy: { registryVersion: "test", initializedPackages: [] },
    ecommerceSpec: {
      storeType: "general",
      targetCustomers: [],
      productCategories: [],
      mainProducts: [],
      requiredFeatures: [],
    },
    brand: {
      name: "Test Store",
      tone: "minimal",
      colors: { primary: "#000000" },
    },
    pages: [],
    features: {
      productListing: true,
      productDetail: false,
      cart: false,
      cartDrawer: false,
      checkout: false,
      productSearch: false,
      productFilter: false,
      wishlist: false,
      reviews: false,
      promotions: false,
      newsletter: false,
      auth: false,
      adminDashboard: false,
      paymentIntegration: "none",
    },
    constraints: { doNotChange: [], preferredComponents: [], forbiddenLibraries: [], notes: [] },
    fileManifest: [],
    decisionLog: [],
    recentChanges: [],
    ...overrides,
  };
}

export function createTestToolContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    userId: "user_test",
    projectId: "project_test",
    messageId: "msg_test",
    workspaceRoot: join(tmpdir(), "project_test"),
    projectState: createTestProjectState(),
    ...overrides,
  };
}

export async function createTempWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "code-tools-"));
  return {
    workspaceRoot,
    cleanup: () => rm(workspaceRoot, { recursive: true, force: true }),
  };
}
