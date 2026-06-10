import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export type InitSettingsSeedErrorCode =
  | "conflicting_runtime_file"
  | "template_invalid"
  | "write_failed"
  | "install_failed";

export class InitSettingsSeedError extends Error {
  constructor(
    public readonly code: InitSettingsSeedErrorCode,
    message: string,
    public readonly targetPath?: string,
  ) {
    super(message);
    this.name = "InitSettingsSeedError";
  }
}

type SeedTarget = {
  template: string;
  target: string;
  policy: "runtime_owned" | "editable_baseline";
};

const SETTINGS_TEMPLATE_ROOT = path.resolve(
  process.cwd(),
  "templates/codex-builder/init/settings",
);

const SEED_TARGETS: readonly SeedTarget[] = [
  { template: "package.json.md", target: "package.json", policy: "runtime_owned" },
  { template: "vite.config.ts.md", target: "vite.config.ts", policy: "runtime_owned" },
  { template: "tsconfig.json.md", target: "tsconfig.json", policy: "runtime_owned" },
  { template: "tailwind.config.ts.md", target: "tailwind.config.ts", policy: "runtime_owned" },
  { template: "postcss.config.cjs.md", target: "postcss.config.cjs", policy: "runtime_owned" },
  { template: "src-router.tsx.md", target: "src/router.tsx", policy: "runtime_owned" },
  { template: "src-styles-app.css.md", target: "src/styles/app.css", policy: "editable_baseline" },
  { template: "src-routes-root.tsx.md", target: "src/routes/__root.tsx", policy: "editable_baseline" },
];

function parseSeedTemplate(raw: string, expectedTarget: string): { target: string; body: string } {
  if (!raw.startsWith("---\n")) {
    throw new InitSettingsSeedError(
      "template_invalid",
      `seed template for ${expectedTarget} is missing frontmatter`,
      expectedTarget,
    );
  }

  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new InitSettingsSeedError(
      "template_invalid",
      `seed template for ${expectedTarget} has invalid frontmatter`,
      expectedTarget,
    );
  }

  const frontmatter = raw.slice(4, end);
  const targetLine = frontmatter
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("target:"));
  const target = targetLine?.slice("target:".length).trim().replace(/^['"]|['"]$/g, "");

  if (!target) {
    throw new InitSettingsSeedError(
      "template_invalid",
      `seed template for ${expectedTarget} is missing target`,
      expectedTarget,
    );
  }
  if (target !== expectedTarget) {
    throw new InitSettingsSeedError(
      "template_invalid",
      `seed template target mismatch: expected ${expectedTarget}, got ${target}`,
      expectedTarget,
    );
  }

  return { target, body: raw.slice(end + "\n---\n".length) };
}

function validateTargetPath(target: string): void {
  const normalized = target.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new InitSettingsSeedError(
      "template_invalid",
      `seed target is outside workspace: ${target}`,
      target,
    );
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeSeedFile(absTarget: string, body: string, target: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(absTarget), { recursive: true });
    await fs.writeFile(absTarget, body, "utf8");
  } catch (error) {
    throw new InitSettingsSeedError(
      "write_failed",
      `failed to write init seed file ${target}: ${error instanceof Error ? error.message : String(error)}`,
      target,
    );
  }
}

export async function seedInitSettingsFiles(input: { draftWorkspacePath: string }): Promise<void> {
  for (const seedTarget of SEED_TARGETS) {
    validateTargetPath(seedTarget.target);

    const raw = await fs.readFile(path.join(SETTINGS_TEMPLATE_ROOT, seedTarget.template), "utf8");
    const { body } = parseSeedTemplate(raw, seedTarget.target);
    const absTarget = path.join(input.draftWorkspacePath, seedTarget.target);
    const exists = await pathExists(absTarget);

    if (!exists) {
      await writeSeedFile(absTarget, body, seedTarget.target);
      continue;
    }

    if (seedTarget.policy === "editable_baseline") continue;

    const current = await fs.readFile(absTarget, "utf8");
    if (current !== body) {
      throw new InitSettingsSeedError(
        "conflicting_runtime_file",
        `init settings seed refused to overwrite runtime-owned file: ${seedTarget.target}`,
        seedTarget.target,
      );
    }
  }
}

export async function installInitWorkspaceDependencies(input: {
  draftWorkspacePath: string;
  signal?: AbortSignal;
}): Promise<void> {
  const nodeModulesExists = await pathExists(path.join(input.draftWorkspacePath, "node_modules"));
  const lockfileExists = await pathExists(path.join(input.draftWorkspacePath, "pnpm-lock.yaml"));
  if (nodeModulesExists && lockfileExists) return;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["install", "--frozen-lockfile=false"], {
      cwd: input.draftWorkspacePath,
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    if (input.signal) {
      const onAbort = () => child.kill("SIGTERM");
      input.signal.addEventListener("abort", onAbort, { once: true });
      child.once("close", () => input.signal?.removeEventListener("abort", onAbort));
    }

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const summary = [stdout, stderr].filter(Boolean).join("\n").split(/\r?\n/).slice(-30).join("\n");
      reject(
        new InitSettingsSeedError(
          "install_failed",
          `failed to install init workspace dependencies${summary ? `: ${summary}` : ""}`,
        ),
      );
    });

    child.on("error", (error) => {
      reject(
        new InitSettingsSeedError(
          "install_failed",
          `failed to install init workspace dependencies: ${error.message}`,
        ),
      );
    });
  });
}
