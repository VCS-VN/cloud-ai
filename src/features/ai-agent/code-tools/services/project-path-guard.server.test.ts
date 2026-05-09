/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { guardProjectPath, isForbiddenProjectPath } from "./project-path-guard.server";

describe("project path guard", () => {
  const workspaceRoot = "/tmp/workspace/project";

  it("allows safe relative paths", () => {
    expect(guardProjectPath({ workspaceRoot, path: "src/components/ProductCard.tsx" })).toEqual({
      ok: true,
      relativePath: "src/components/ProductCard.tsx",
      absolutePath: "/tmp/workspace/project/src/components/ProductCard.tsx",
    });
  });

  it("blocks traversal paths", () => {
    expect(guardProjectPath({ workspaceRoot, path: "../secrets.env" })).toMatchObject({
      ok: false,
      code: "UNSAFE_PROJECT_PATH",
    });
  });

  it("blocks absolute paths", () => {
    expect(guardProjectPath({ workspaceRoot, path: "/tmp/workspace/project/src/App.tsx" })).toMatchObject({
      ok: false,
      code: "UNSAFE_PROJECT_PATH",
    });
  });

  it("blocks forbidden files and directories", () => {
    expect(isForbiddenProjectPath(".env")).toBe(true);
    expect(isForbiddenProjectPath("node_modules/react/index.js")).toBe(true);
    expect(isForbiddenProjectPath("dist/assets/app.js")).toBe(true);
    expect(guardProjectPath({ workspaceRoot, path: "src/.secret" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN_PROJECT_PATH",
    });
  });
});
