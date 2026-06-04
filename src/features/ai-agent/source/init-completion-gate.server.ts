import { readProjectFile } from "../code-tools/services/project-file-reader.server";
import {
  findForbiddenCustomerCopySnippets,
  hasCatalogUiSignal,
  scanStorefrontCustomerCopy,
} from "../code-tools/services/storefront-customer-copy-guard.server";

const INIT_ROUTE_COPY_PATHS = [
  "src/routes/index.tsx",
  "src/routes/products/index.tsx",
  "src/routes/products/$productId.tsx",
  "src/routes/cart.tsx",
  "src/routes/checkout.tsx",
] as const;

export type InitStorefrontCompletionAssessment = {
  ok: boolean;
  blockers: string[];
};

export async function assessInitStorefrontCompletion(input: {
  workspaceRoot: string;
  presentPaths: ReadonlySet<string>;
}): Promise<InitStorefrontCompletionAssessment> {
  const blockers: string[] = [];

  const indexFile = await readProjectFile({
    workspaceRoot: input.workspaceRoot,
    path: "src/routes/index.tsx",
  });
  if (!indexFile.ok) {
    blockers.push("src/routes/index.tsx is missing");
  } else {
    const forbidden = findForbiddenCustomerCopySnippets(indexFile.data.content);
    if (forbidden.length > 0) {
      blockers.push(
        `home route still contains builder jargon (${forbidden.slice(0, 3).join(", ")})`,
      );
    }
    if (!hasCatalogUiSignal(indexFile.data.content, input.presentPaths)) {
      blockers.push(
        "home must wire useProductsList and render a product grid (or add src/components/store/product-grid.tsx)",
      );
    }
  }

  for (const path of INIT_ROUTE_COPY_PATHS) {
    if (path === "src/routes/index.tsx") continue;
    const file = await readProjectFile({ workspaceRoot: input.workspaceRoot, path });
    if (!file.ok) continue;
    const scan = scanStorefrontCustomerCopy({ source: file.data.content, path });
    if (!scan.ok) {
      blockers.push(
        `${path} contains builder jargon (${scan.violations[0]?.sample ?? "forbidden phrase"})`,
      );
    }
  }

  return { ok: blockers.length === 0, blockers };
}

export function buildInitCompletionBlockedMessage(blockers: string[]): string {
  const detail = blockers.length > 0 ? blockers.join("; ") : "storefront UI incomplete";
  return (
    `Init is incomplete. ${detail}. Wire useProductsList on home, create product-grid and product-card under src/components/store/, remove builder jargon from routes, and use write or project_create_file before finishing with text-only replies.`
  );
}
