import fs from "node:fs/promises";
import path from "node:path";
import type { ValidationOutcome } from "./typecheck.server";

const ROOT_ROUTE_REL = "src/routes/__root.tsx";
const APP_CSS_REL = "src/styles/app.css";
const REQUIRED_ROOT_IMPORTS = [
  "import '@vitejs/plugin-react/preamble';",
  "import '@/styles/app.css';",
];
const REQUIRED_TAILWIND_LINES = [
  "@tailwind base;",
  "@tailwind components;",
  "@tailwind utilities;",
];
const PROVIDERS_IMPORT = 'import { Providers } from "@/app/providers";';

async function readText(absPath: string): Promise<string | null> {
  try {
    return await fs.readFile(absPath, "utf8");
  } catch {
    return null;
  }
}

function firstNonEmptyLines(content: string, count: number): string[] {
  return content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

export async function runRootStyleContract(
  draftWorkspacePath: string,
): Promise<ValidationOutcome> {
  const startedAt = Date.now();
  const failures: string[] = [];
  const root = await readText(path.join(draftWorkspacePath, ROOT_ROUTE_REL));
  const appCss = await readText(path.join(draftWorkspacePath, APP_CSS_REL));

  if (!root) {
    failures.push(`${ROOT_ROUTE_REL} is missing.`);
  } else {
    const firstImports = firstNonEmptyLines(root, 2);
    for (let index = 0; index < REQUIRED_ROOT_IMPORTS.length; index++) {
      if (firstImports[index] !== REQUIRED_ROOT_IMPORTS[index]) {
        failures.push(
          `${ROOT_ROUTE_REL} line ${index + 1} must be exactly ${REQUIRED_ROOT_IMPORTS[index]}`,
        );
      }
    }
    if (!root.includes("<Providers>")) {
      failures.push(`${ROOT_ROUTE_REL} must render <Providers>.`);
    }
    if (!root.includes(PROVIDERS_IMPORT)) {
      failures.push(`${ROOT_ROUTE_REL} must import Providers from "@/app/providers".`);
    }
    if (!/<Providers\b[^>]*>[\s\S]*<Outlet\s*\/>[\s\S]*<\/Providers>/m.test(root)) {
      failures.push(`${ROOT_ROUTE_REL} must wrap <Outlet /> inside <Providers>...</Providers>.`);
    }
    if (!root.includes("<Scripts />")) {
      failures.push(`${ROOT_ROUTE_REL} must render <Scripts /> inside <body>.`);
    }
  }

  if (!appCss) {
    failures.push(`${APP_CSS_REL} is missing.`);
  } else {
    const firstTailwindLines = firstNonEmptyLines(appCss, 3);
    for (let index = 0; index < REQUIRED_TAILWIND_LINES.length; index++) {
      if (firstTailwindLines[index] !== REQUIRED_TAILWIND_LINES[index]) {
        failures.push(
          `${APP_CSS_REL} line ${index + 1} must be exactly ${REQUIRED_TAILWIND_LINES[index]}`,
        );
      }
    }
    if (
      !appCss.includes("/* DESIGN_TOKENS_START */") ||
      !appCss.includes("/* DESIGN_TOKENS_END */")
    ) {
      failures.push(
        `${APP_CSS_REL} must preserve DESIGN_TOKENS_START and DESIGN_TOKENS_END markers.`,
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  if (failures.length === 0) return { ok: true, durationMs };
  return {
    ok: false,
    durationMs,
    summary: failures.join("\n"),
    errorCount: failures.length,
  };
}
