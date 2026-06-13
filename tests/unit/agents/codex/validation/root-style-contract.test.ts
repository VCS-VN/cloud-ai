import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runRootStyleContract } from "@/features/agents/codex/validation/root-style-contract.server";

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "root-style-contract-"));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

async function writeProjectFile(rel: string, body: string) {
  const abs = path.join(workspace, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body, "utf8");
}

async function writeValidWorkspace() {
  await writeProjectFile(
    "src/routes/__root.tsx",
    [
      "import '@vitejs/plugin-react/preamble';",
      "import '@/styles/app.css';",
      "import { Outlet, Scripts } from '@tanstack/react-router';",
      'import { Providers } from "@/app/providers";',
      "",
      "export function Root() {",
      "  return <body><Providers><Outlet /></Providers><Scripts /></body>;",
      "}",
    ].join("\n"),
  );
  await writeProjectFile(
    "src/styles/app.css",
    [
      "@tailwind base;",
      "@tailwind components;",
      "@tailwind utilities;",
      "",
      "/* DESIGN_TOKENS_START */",
      ":root { --background: #fff; }",
      "/* DESIGN_TOKENS_END */",
      "",
      ".brand-frame { letter-spacing: 0; }",
    ].join("\n"),
  );
}

describe("runRootStyleContract", () => {
  it("passes when root imports and style token markers are intact", async () => {
    await writeValidWorkspace();

    await expect(runRootStyleContract(workspace)).resolves.toMatchObject({
      ok: true,
    });
  });

  it("fails when root import order and style markers are broken", async () => {
    await writeValidWorkspace();
    await writeProjectFile(
      "src/routes/__root.tsx",
      [
        "import '@/styles/app.css';",
        "import '@vitejs/plugin-react/preamble';",
        "export function Root() { return <body />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      "src/styles/app.css",
      ["@tailwind base;", "@tailwind utilities;"].join("\n"),
    );

    const result = await runRootStyleContract(workspace);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.summary).toContain("src/routes/__root.tsx line 1");
      expect(result.summary).toContain("DESIGN_TOKENS_START");
      expect(result.summary).toContain("must wrap <Outlet /> inside <Providers>");
    }
  });
});
