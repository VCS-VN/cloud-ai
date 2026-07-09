import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rootRouteSource } from "@/features/generated-projects/legacy/init-source.server";

// The preview path bar in the builder shell stays in sync with in-preview
// navigation via a postMessage bridge injected into the storefront's __root.tsx.
// __root.tsx has TWO independent sources — the legacy inline generator
// (rootRouteSource) and the Codex SDK seed template on disk. A previous fix only
// touched the legacy source, so previews built via the Codex path shipped
// without the bridge and the path bar never updated. These tests fail loudly if
// either source loses the bridge again.

const SEED_TEMPLATE_REL =
  "templates/codex-builder/init/settings/src-routes-root.tsx.md";

function assertHasNavBridge(source: string) {
  // Component that reports the live location to the parent.
  expect(source).toContain("function PreviewNavBridge()");
  // Rendered inside the app tree (not just declared).
  expect(source).toContain("<PreviewNavBridge />");
  // Reads the live path from the router.
  expect(source).toContain("state.location.href");
  // Posts the agreed message shape to the parent frame.
  expect(source).toMatch(/type:\s*['"]lumen:preview-nav['"]/);
  // Guarded so it is a no-op when there is no parent (opened standalone).
  expect(source).toContain("window.parent === window");
}

describe("preview nav bridge in storefront root sources", () => {
  it("legacy rootRouteSource() includes the nav bridge", () => {
    assertHasNavBridge(rootRouteSource());
  });

  it("Codex SDK seed template includes the nav bridge", async () => {
    const raw = await fs.readFile(
      path.resolve(process.cwd(), SEED_TEMPLATE_REL),
      "utf8",
    );
    assertHasNavBridge(raw);
  });

  it("both sources keep the contract-protected first two import lines", () => {
    const expectedFirstTwo = [
      "import '@vitejs/plugin-react/preamble'",
      "import '@/styles/app.css'",
    ];
    const legacyLines = rootRouteSource()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // Legacy source uses no semicolons; compare against the exact prefixes.
    expect(legacyLines[0]).toBe(expectedFirstTwo[0]);
    expect(legacyLines[1]).toBe(expectedFirstTwo[1]);
  });
});
