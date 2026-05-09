import {
  assertStorefrontImportAliases,
  validateStorefrontImportAliases,
} from "./import-alias-validator";

describe("validateStorefrontImportAliases", () => {
  it("accepts @ alias imports and package imports", () => {
    const violations = validateStorefrontImportAliases([
      {
        path: "src/components/store/product-grid.tsx",
        content: `import { createFileRoute } from '@tanstack/react-router'
import { products } from '@/data/products'
import { ProductCard } from '@/components/store/product-card'
import '@/styles/app.css'
`,
      },
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects legacy ~ alias and parent-relative internal imports", () => {
    const violations = validateStorefrontImportAliases([
      {
        path: "src/components/layout/site-header.tsx",
        content: `import '~/styles/app.css'
import { websiteConfig } from '../../lib/website-config'
export { ProductCard } from '../store/product-card'
`,
      },
    ]);

    expect(violations).toEqual([
      {
        path: "src/components/layout/site-header.tsx",
        specifier: "~/styles/app.css",
        reason: "legacy_alias",
      },
      {
        path: "src/components/layout/site-header.tsx",
        specifier: "../../lib/website-config",
        reason: "relative_internal_import",
      },
      {
        path: "src/components/layout/site-header.tsx",
        specifier: "../store/product-card",
        reason: "relative_internal_import",
      },
    ]);
  });

  it("allows router routeTree convention only in src/router.tsx", () => {
    expect(
      validateStorefrontImportAliases([
        { path: "src/router.tsx", content: `import { routeTree } from './routeTree.gen'` },
      ]),
    ).toEqual([]);

    expect(
      validateStorefrontImportAliases([
        { path: "src/routes/__root.tsx", content: `import { routeTree } from './routeTree.gen'` },
      ]),
    ).toEqual([
      {
        path: "src/routes/__root.tsx",
        specifier: "./routeTree.gen",
        reason: "relative_internal_import",
      },
    ]);
  });

  it("throws a safe error before invalid patches are applied", () => {
    expect(() =>
      assertStorefrontImportAliases([
        {
          type: "modify_file",
          path: "src/components/store/product-grid.tsx",
          content: `import { ProductCard } from '../store/product-card'`,
        },
      ]),
    ).toThrow(/INVALID_STOREFRONT_IMPORT_ALIAS/);
  });
});
