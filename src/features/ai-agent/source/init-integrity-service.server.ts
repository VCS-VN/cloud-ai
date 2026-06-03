import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  REQUIRED_GENERATED_STOREFRONT_FILES,
  REQUIRED_INIT_COMMERCE_ROUTE_FILES,
} from "./generated-project-layout";
import {
  DESIGN_TOKENS_END,
  DESIGN_TOKENS_START,
} from "../code-tools/services/design-token-mapping-service.server";

export type InitIntegrityViolation = {
  code:
    | "MISSING_REQUIRED_FILE"
    | "ROUTE_TREE_STUB"
    | "ROUTE_CONTRACT_MISSING"
    | "CSS_TOKEN_MAPPING_INVALID"
    | "FORBIDDEN_SAMPLE_DATA_IMPORT"
    | "DATA_HOOK_CONTRACT_MISSING";
  path: string;
  message: string;
};

export type InitIntegrityResult = {
  ok: boolean;
  violations: InitIntegrityViolation[];
};

const ROUTE_CONTRACTS: ReadonlyArray<{
  path: string;
  route: string;
  requiredSnippets?: readonly string[];
}> = [
  { path: "src/routes/index.tsx", route: "/" },
  { path: "src/routes/products/route.tsx", route: "/products" },
  {
    path: "src/routes/products/index.tsx",
    route: "/products/",
    requiredSnippets: ["useProductsList", "useCategoriesList"],
  },
  {
    path: "src/routes/products/$productId.tsx",
    route: "/products/$productId",
    requiredSnippets: ["useProductDetail", "useCart"],
  },
  {
    path: "src/routes/cart.tsx",
    route: "/cart",
    requiredSnippets: ["useCart", "selectedCartItemIdsAtom"],
  },
  { path: "src/routes/checkout.tsx", route: "/checkout" },
  { path: "src/routes/orders/index.tsx", route: "/orders/" },
  { path: "src/routes/orders/$orderId.tsx", route: "/orders/$orderId" },
];

const ADDITIONAL_DATA_HOOK_CONTRACTS: ReadonlyArray<{
  path: string;
  requiredSnippets: readonly string[];
}> = [
  {
    path: "src/components/layout/site-header.tsx",
    requiredSnippets: ["useStore", "useCart", "useProductSuggestions"],
  },
  {
    path: "src/components/store/product-grid.tsx",
    requiredSnippets: ["useProductsList"],
  },
  {
    path: "src/components/store/product-card.tsx",
    requiredSnippets: ["formatMoney", "resolveProductPrice"],
  },
];

const FORBIDDEN_SAMPLE_DATA_IMPORT_RE =
  /from\s+['"]@\/data\/(?:products|categories)['"]/;

const REQUIRED_CSS_VARS = [
  "background",
  "foreground",
  "primary",
  "border",
  "radius",
] as const;

export async function validateInitIntegrity(input: {
  workspaceRoot: string;
}): Promise<InitIntegrityResult> {
  const violations: InitIntegrityViolation[] = [];

  for (const filePath of REQUIRED_GENERATED_STOREFRONT_FILES) {
    if (!(await readProjectFile(input.workspaceRoot, filePath))) {
      violations.push({
        code: "MISSING_REQUIRED_FILE",
        path: filePath,
        message: `Required generated storefront file is missing: ${filePath}`,
      });
    }
  }

  await validateRouteTree(input.workspaceRoot, violations);
  await validateRoutes(input.workspaceRoot, violations);
  await validateCss(input.workspaceRoot, violations);
  await validateDataContracts(input.workspaceRoot, violations);

  return { ok: violations.length === 0, violations };
}

export function formatInitIntegrityViolations(
  violations: readonly InitIntegrityViolation[],
): string {
  return violations
    .slice(0, 20)
    .map((violation) => `${violation.path}: ${violation.message}`)
    .join("\n");
}

async function validateRouteTree(
  workspaceRoot: string,
  violations: InitIntegrityViolation[],
) {
  const source = await readProjectFile(workspaceRoot, "src/routeTree.gen.ts");
  if (!source) return;
  if (/routeTree\s*=\s*\{\}\s+as\s+never/.test(source)) {
    violations.push({
      code: "ROUTE_TREE_STUB",
      path: "src/routeTree.gen.ts",
      message: "routeTree.gen.ts is still the empty stub.",
    });
    return;
  }

  for (const routePath of REQUIRED_INIT_COMMERCE_ROUTE_FILES) {
    const importPath = `./${routePath.replace(/^src\//, "").replace(/\.tsx$/, "")}`;
    if (!source.includes(importPath)) {
      violations.push({
        code: "ROUTE_CONTRACT_MISSING",
        path: "src/routeTree.gen.ts",
        message: `routeTree.gen.ts does not register ${routePath}.`,
      });
    }
  }
}

async function validateRoutes(
  workspaceRoot: string,
  violations: InitIntegrityViolation[],
) {
  for (const contract of ROUTE_CONTRACTS) {
    const source = await readProjectFile(workspaceRoot, contract.path);
    if (!source) continue;
    if (!source.includes(`createFileRoute('${contract.route}')`) &&
      !source.includes(`createFileRoute("${contract.route}")`)) {
      violations.push({
        code: "ROUTE_CONTRACT_MISSING",
        path: contract.path,
        message: `Route file must declare createFileRoute('${contract.route}').`,
      });
    }
    for (const snippet of contract.requiredSnippets ?? []) {
      if (!source.includes(snippet)) {
        violations.push({
          code: "DATA_HOOK_CONTRACT_MISSING",
          path: contract.path,
          message: `Route file is missing required contract snippet: ${snippet}.`,
        });
      }
    }
  }
}

async function validateCss(
  workspaceRoot: string,
  violations: InitIntegrityViolation[],
) {
  const appCss = await readProjectFile(workspaceRoot, "src/styles/app.css");
  if (!appCss) return;
  const start = appCss.indexOf(DESIGN_TOKENS_START);
  const end = appCss.indexOf(DESIGN_TOKENS_END);
  if (start === -1 || end === -1 || end < start) {
    violations.push({
      code: "CSS_TOKEN_MAPPING_INVALID",
      path: "src/styles/app.css",
      message: "app.css is missing DESIGN_TOKENS_START / DESIGN_TOKENS_END markers.",
    });
    return;
  }
  const tokenRegion = appCss.slice(start, end);
  const missingVars = REQUIRED_CSS_VARS.filter(
    (name) => !new RegExp(`--${escapeRegex(name)}:\\s*[^;\\s][^;]*;`).test(tokenRegion),
  );
  if (missingVars.length > 0) {
    violations.push({
      code: "CSS_TOKEN_MAPPING_INVALID",
      path: "src/styles/app.css",
      message: `app.css token region is missing required variables: ${missingVars.join(", ")}.`,
    });
  }
}

async function validateDataContracts(
  workspaceRoot: string,
  violations: InitIntegrityViolation[],
) {
  const files = await collectFiles(workspaceRoot, ["src/routes", "src/components/store"]);
  for (const filePath of files) {
    const source = await readProjectFile(workspaceRoot, filePath);
    if (!source) continue;
    if (FORBIDDEN_SAMPLE_DATA_IMPORT_RE.test(source)) {
      violations.push({
        code: "FORBIDDEN_SAMPLE_DATA_IMPORT",
        path: filePath,
        message:
          "Routes and storefront components must use store service hooks, not direct @/data products/categories imports.",
      });
    }
  }

  for (const contract of ADDITIONAL_DATA_HOOK_CONTRACTS) {
    const source = await readProjectFile(workspaceRoot, contract.path);
    if (!source) continue;
    for (const snippet of contract.requiredSnippets) {
      if (!source.includes(snippet)) {
        violations.push({
          code: "DATA_HOOK_CONTRACT_MISSING",
          path: contract.path,
          message: `Storefront component is missing required contract snippet: ${snippet}.`,
        });
      }
    }
  }
}

async function collectFiles(workspaceRoot: string, roots: readonly string[]) {
  const out: string[] = [];
  async function walk(relativeDir: string) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(path.join(workspaceRoot, relativeDir), {
        withFileTypes: true,
      });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(child);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(child);
      }
    }
  }
  for (const root of roots) await walk(root);
  return out;
}

async function readProjectFile(workspaceRoot: string, relativePath: string) {
  try {
    return await readFile(path.join(workspaceRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
