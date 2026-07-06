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
  // app.css is an editable baseline: it carries the shadcn CSS-variable token region
  // (between DESIGN_TOKENS_START/END) that the ui primitives + components bind
  // to via tailwind.config. The model may extend global CSS from the selected
  // style variant, but validation requires the Tailwind directives and token
  // markers to stay intact. The build loop also injects the project's DESIGN.md
  // palette into the token region afterward.
  { template: "src-styles-app.css.md", target: "src/styles/app.css", policy: "editable_baseline" },
  // __root.tsx wires the whole app shell: the side-effect import order
  // (preamble + app.css first), <Providers>, app chrome (RouteLoadingBar/
  // SiteHeader/Suspense(Outlet)/SiteFooter/Toaster), and <Scripts />. The model
  // repeatedly left out the <Providers> import/wrapper or mis-ordered it, so the
  // storefront mounted hooks with no QueryClient/Store/Auth/Cart context and
  // crashed. This file is pure plumbing with one correct shape — seed it
  // runtime-owned. SiteHeader/SiteFooter/NotFound are agent-authored at fixed
  // paths (see component.md); RouteLoadingBar/theme-toggle/Toaster are seeded.
  { template: "src-routes-root.tsx.md", target: "src/routes/__root.tsx", policy: "runtime_owned" },
  // Chrome plumbing the root + header import. component.md declares these
  // PRE-SEEDED, but nothing created them — so __root's `import { RouteLoadingBar }`
  // and SiteHeader's `import { ThemeToggle }` failed to resolve and the app
  // would not mount. Seed them runtime-owned so the contract holds.
  { template: "src-components-layout-route-loading-bar.tsx.md", target: "src/components/layout/route-loading-bar.tsx", policy: "runtime_owned" },
  { template: "src-components-layout-theme-toggle.tsx.md", target: "src/components/layout/theme-toggle.tsx", policy: "runtime_owned" },
  // cn util + shadcn ui primitives. packages.md promises these are "already on
  // disk", but nothing created them — so every component importing
  // @/components/ui/* or @/lib/utils failed typecheck. Seed them runtime-owned
  // so the contract holds before the agent loop. Versions match the radix
  // majors pinned in package.json.md (dialog/label/popover/radio-group/select/
  // separator/slot) + cva/clsx/tailwind-merge/sonner (all already deps).
  { template: "src-lib-utils.ts.md", target: "src/lib/utils.ts", policy: "runtime_owned" },
  { template: "src-components-ui-button.tsx.md", target: "src/components/ui/button.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-card.tsx.md", target: "src/components/ui/card.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-input.tsx.md", target: "src/components/ui/input.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-badge.tsx.md", target: "src/components/ui/badge.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-separator.tsx.md", target: "src/components/ui/separator.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-label.tsx.md", target: "src/components/ui/label.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-select.tsx.md", target: "src/components/ui/select.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-radio-group.tsx.md", target: "src/components/ui/radio-group.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-dialog.tsx.md", target: "src/components/ui/dialog.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-sheet.tsx.md", target: "src/components/ui/sheet.tsx", policy: "runtime_owned" },
  { template: "src-components-ui-sonner.tsx.md", target: "src/components/ui/sonner.tsx", policy: "runtime_owned" },
  // Fixed plumbing layer. These files have ONE correct shape across every
  // project — the hooks/providers/apiClient/format-money are pure contract,
  // not creative work. The model (cloud-ai) repeatedly dead-ended trying to
  // author them turn-by-turn, AND when it did write them it produced broken
  // contracts (react-query v5 onSuccess/onError removed, wrong cart API,
  // lodash import with no dep, missing apiClient). Seed them runtime-owned so
  // the contract holds before the agent loop; the model only authors DESIGN.md,
  // components, and pages. Data entities are seeded as a working baseline the
  // model may overwrite per the store brief.
  { template: "src-vite-env.d.ts.md", target: "src/vite-env.d.ts", policy: "runtime_owned" },
  { template: "src-services-http-client.ts.md", target: "src/services/http/client.ts", policy: "runtime_owned" },
  { template: "src-lib-website-config.ts.md", target: "src/lib/website-config.ts", policy: "runtime_owned" },
  { template: "src-lib-format-money.ts.md", target: "src/lib/format-money.ts", policy: "runtime_owned" },
  { template: "src-app-cart-selection.ts.md", target: "src/app/cart-selection.ts", policy: "runtime_owned" },
  { template: "src-app-providers.tsx.md", target: "src/app/providers.tsx", policy: "runtime_owned" },
  { template: "src-app-store-provider.tsx.md", target: "src/app/store-provider.tsx", policy: "runtime_owned" },
  { template: "src-app-auth-provider.tsx.md", target: "src/app/auth-provider.tsx", policy: "runtime_owned" },
  { template: "src-app-cart-provider.tsx.md", target: "src/app/cart-provider.tsx", policy: "runtime_owned" },
  { template: "src-services-store-use-store-detail.ts.md", target: "src/services/store/use-store-detail.ts", policy: "runtime_owned" },
  { template: "src-services-store-use-products-list.ts.md", target: "src/services/store/use-products-list.ts", policy: "runtime_owned" },
  { template: "src-services-store-use-product-detail.ts.md", target: "src/services/store/use-product-detail.ts", policy: "runtime_owned" },
  { template: "src-services-store-use-categories-list.ts.md", target: "src/services/store/use-categories-list.ts", policy: "runtime_owned" },
  { template: "src-services-store-use-product-suggestions.ts.md", target: "src/services/store/use-product-suggestions.ts", policy: "runtime_owned" },
  { template: "src-data-sample-store.ts.md", target: "src/data/sample-store.ts", policy: "editable_baseline" },
  { template: "src-data-products.ts.md", target: "src/data/products.ts", policy: "editable_baseline" },
  { template: "src-data-categories.ts.md", target: "src/data/categories.ts", policy: "editable_baseline" },
  // The homepage (src/routes/index.tsx) is the ONE route the agent authors at
  // init: it carries the storefront's visual identity (hero, catalog, CTAs) and
  // is regenerated per brief. editable_baseline so the agent's home write
  // survives the reassert pass.
  { template: "src-routes-index.tsx.md", target: "src/routes/index.tsx", policy: "editable_baseline" },
  // The remaining commerce routes are seeded as working skeletons and kept
  // runtime_owned: init builds the home page + components only, so any route
  // the model touches here (it is still told these paths exist) is reverted to
  // the canonical seed by reassertRuntimeOwnedFiles after the batch loop. They
  // become editable later only via explicit user update/new_route runs.
  { template: "src-routes-products-index.tsx.md", target: "src/routes/products/index.tsx", policy: "runtime_owned" },
  { template: "src-routes-products-productId.tsx.md", target: "src/routes/products/$productId.tsx", policy: "runtime_owned" },
  { template: "src-routes-cart.tsx.md", target: "src/routes/cart.tsx", policy: "runtime_owned" },
  { template: "src-routes-checkout.tsx.md", target: "src/routes/checkout.tsx", policy: "runtime_owned" },
  { template: "src-routes-orders.tsx.md", target: "src/routes/orders.tsx", policy: "runtime_owned" },
  { template: "src-routes-orders-orderId.tsx.md", target: "src/routes/orders/$orderId.tsx", policy: "runtime_owned" },
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

// Written into every generated project so the Codex CLI's own file discovery
// (it honors .gitignore even with skipGitRepoCheck) never walks dependency,
// VCS, or build-artifact trees. The project builds to dist/client, so without
// this the CLI reads the entire compiled bundle into context — huge token cost
// on every follow-up prompt. Keep in sync with IGNORED_WORKSPACE_DIRS.
const PROJECT_GITIGNORE = [
  "node_modules",
  "dist",
  ".output",
  ".tanstack",
  ".nitro",
  ".vinxi",
  ".env",
  "*.log",
  "",
].join("\n");

/**
 * Idempotently ensure the project workspace has a .gitignore excluding build
 * artifacts / deps. Called on init AND on every update/new-route run so that
 * projects created before this seed existed still get one on their next prompt.
 */
export async function ensureProjectGitignore(input: {
  draftWorkspacePath: string;
}): Promise<void> {
  const gitignorePath = path.join(input.draftWorkspacePath, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    await writeSeedFile(gitignorePath, PROJECT_GITIGNORE, ".gitignore");
  }
}

export async function seedInitSettingsFiles(input: { draftWorkspacePath: string }): Promise<void> {
  await ensureProjectGitignore(input);

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

// Codex writes files straight to disk inside the CLI; the app cannot stop the
// model from overwriting a runtime-owned plumbing file mid-loop. The model
// (cloud-ai) ignores the "DO NOT touch pre-seeded files" instruction in
// system.md, so prompt rules alone do not hold the contract. After the build
// loop, force every `runtime_owned` seed file back to its canonical body — any
// model edit to plumbing (e.g. a __root.tsx that dropped <Providers>, a hook
// rewritten with react-query v5 onSuccess) is reverted before the typecheck/
// build/preview gates. `editable_baseline` files (app.css, data entities) are
// left as-is because the model is allowed to customize them per the brief.
// Returns the list of relative paths that were restored (for logging).
export async function reassertRuntimeOwnedFiles(input: {
  draftWorkspacePath: string;
}): Promise<string[]> {
  const restored: string[] = [];
  for (const seedTarget of SEED_TARGETS) {
    if (seedTarget.policy !== "runtime_owned") continue;
    validateTargetPath(seedTarget.target);

    const raw = await fs.readFile(
      path.join(SETTINGS_TEMPLATE_ROOT, seedTarget.template),
      "utf8",
    );
    const { body } = parseSeedTemplate(raw, seedTarget.target);
    const absTarget = path.join(input.draftWorkspacePath, seedTarget.target);

    const current = await pathExists(absTarget)
      ? await fs.readFile(absTarget, "utf8")
      : null;
    if (current === body) continue;

    await writeSeedFile(absTarget, body, seedTarget.target);
    restored.push(seedTarget.target);
  }
  return restored;
}

const APP_CSS_REL = "src/styles/app.css";
const DESIGN_TOKENS_START = "/* DESIGN_TOKENS_START */";
const DESIGN_TOKENS_END = "/* DESIGN_TOKENS_END */";
const REQUIRED_TAILWIND_DIRECTIVES = [
  "@tailwind base;",
  "@tailwind components;",
  "@tailwind utilities;",
];

// The model declares its chosen palette in DESIGN.md front-matter as a flat
// `palette:` map (primary, background, foreground, card, border, ring, …) per
// the system.md authoring rules. app.css ships a neutral default palette inside
// the DESIGN_TOKENS_START/END markers; without this step the storefront renders
// in the generic gray default and the model's design intent is discarded. The
// existing token mapper reads `tokens.colors`, NOT the flat `palette:` shape the
// model emits, so it never fired for init. This injector reads the flat palette
// and rewrites the marker region into the full shadcn token set the ui
// primitives + components consume, filling shadcn-only roles (popover, secondary,
// input, destructive) from sensible palette fallbacks. Runs after the agent's
// init batches, so the model's DESIGN.md palette wins while any extra global
// CSS the model added outside the token region is preserved. A missing/garbled
// DESIGN.md leaves the safe default untouched.
const PALETTE_HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function parseDesignPalette(designMarkdown: string): Record<string, string> {
  const fmMatch = designMarkdown.trimStart().match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};
  const lines = fmMatch[1].split(/\r?\n/);
  const palette: Record<string, string> = {};
  let inPalette = false;
  for (const rawLine of lines) {
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (indent === 0) {
      inPalette = /^palette:\s*$/.test(trimmed);
      continue;
    }
    if (!inPalette) continue;
    const pair = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!pair) continue;
    const value = pair[2].trim().replace(/^['"]|['"]$/g, "");
    if (PALETTE_HEX_RE.test(value)) palette[pair[1]] = value;
  }
  return palette;
}

function parseDesignRadius(designMarkdown: string): string | undefined {
  const fmMatch = designMarkdown.trimStart().match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return undefined;
  const m = fmMatch[1].match(/^\s+radius:\s*(.+)$/m);
  if (!m) return undefined;
  const value = m[1].trim().replace(/^['"]|['"]$/g, "");
  return value || undefined;
}

function buildTokenRegion(palette: Record<string, string>, radius: string | undefined): string {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) if (palette[k]) return palette[k];
    return undefined;
  };
  const vars: Array<[string, string | undefined]> = [
    ["background", pick("background")],
    ["foreground", pick("foreground")],
    ["card", pick("card", "background")],
    ["card-foreground", pick("card-foreground", "foreground")],
    ["popover", pick("popover", "card", "background")],
    ["popover-foreground", pick("popover-foreground", "card-foreground", "foreground")],
    ["primary", pick("primary")],
    ["primary-foreground", pick("primary-foreground")],
    ["secondary", pick("secondary", "muted")],
    ["secondary-foreground", pick("secondary-foreground", "foreground")],
    ["muted", pick("muted", "secondary")],
    ["muted-foreground", pick("muted-foreground")],
    ["accent", pick("accent")],
    ["accent-foreground", pick("accent-foreground")],
    // destructive is a shadcn-only role the model's 15-token DESIGN.md palette
    // never declares; the seeded button/ui primitives use `bg-destructive`, so
    // fall back to a safe red rather than leaving the var undefined.
    ["destructive", pick("destructive") ?? "#dc2626"],
    ["destructive-foreground", pick("destructive-foreground", "primary-foreground") ?? "#ffffff"],
    ["border", pick("border")],
    ["input", pick("input", "border")],
    ["ring", pick("ring", "primary")],
    ["highlight", pick("highlight")],
    ["highlight-foreground", pick("highlight-foreground", "foreground")],
    ["deep", pick("deep")],
    ["deep-foreground", pick("deep-foreground", "primary-foreground")],
  ];
  const rootLines = vars
    .filter(([, v]) => v)
    .map(([name, v]) => `    --${name}: ${v};`);
  if (radius) rootLines.push(`    --radius: ${radius};`);
  return [`  :root {`, ...rootLines, `  }`].join("\n");
}

// Inject the model's DESIGN.md palette into app.css's DESIGN_TOKENS region.
// Returns true if app.css was rewritten, false if left at the seeded default
// (no DESIGN.md, no palette, or no markers). Idempotent.
export async function injectDesignPaletteIntoAppCss(input: {
  draftWorkspacePath: string;
}): Promise<boolean> {
  const designPath = path.join(input.draftWorkspacePath, "DESIGN.md");
  const appCssPath = path.join(input.draftWorkspacePath, APP_CSS_REL);
  if (!(await pathExists(designPath)) || !(await pathExists(appCssPath))) return false;

  const designMarkdown = await fs.readFile(designPath, "utf8");
  const palette = parseDesignPalette(designMarkdown);
  // Require the load-bearing roles; otherwise keep the safe default.
  if (!palette.background || !palette.foreground || !palette.primary) return false;

  const appCss = await fs.readFile(appCssPath, "utf8");
  const start = appCss.indexOf(DESIGN_TOKENS_START);
  const end = appCss.indexOf(DESIGN_TOKENS_END);
  if (start === -1 || end === -1 || end < start) return false;

  const region = buildTokenRegion(palette, parseDesignRadius(designMarkdown));
  const before = appCss.slice(0, start + DESIGN_TOKENS_START.length);
  const after = appCss.slice(end);
  const next = `${before}\n${region}\n  ${after}`;
  if (next === appCss) return false;
  await fs.writeFile(appCssPath, next, "utf8");
  return true;
}

export async function enforceTailwindDirectivesAtTop(input: {
  draftWorkspacePath: string;
}): Promise<boolean> {
  const appCssPath = path.join(input.draftWorkspacePath, APP_CSS_REL);
  if (!(await pathExists(appCssPath))) return false;

  const current = await fs.readFile(appCssPath, "utf8");
  const normalized = current.replace(/^\uFEFF/, "");
  const bodyLines = normalized
    .split(/\r?\n/)
    .filter((line) => !/^@tailwind\s+(base|components|utilities)\s*;\s*$/.test(line.trim()));
  while (bodyLines[0]?.trim() === "") bodyLines.shift();
  const next = `${REQUIRED_TAILWIND_DIRECTIVES.join("\n")}\n\n${bodyLines.join("\n").replace(/^\n+/, "")}`;
  if (next === current) return false;
  await fs.writeFile(appCssPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  return true;
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
