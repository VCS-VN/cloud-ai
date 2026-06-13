import { describe, expect, it } from "vitest";
import { detectAppendCorruption } from "@/features/agents/codex/runtime/builder-run.server";

// The exact corrupted __root.tsx the user reported: the seed version (Outlet
// only) followed by three more full-file copies appended on top — 4 distinct
// `export const Route` blocks, repeated imports, and a hallucinated last copy.
const CORRUPTED_ROOT = `import { Outlet, createRootRoute } from "@tanstack/react-router";

import "@/styles/app.css";

export const Route = createRootRoute({
  component: () => <Outlet />,
});
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { StoreProvider } from "@/app/store-provider";
import { CartProvider } from "@/app/cart-provider";
import { AuthProvider } from "@/app/auth-provider";
import "@/styles/app.css";

export const Route = createRootRoute({
  component: () => (
    <StoreProvider>
      <CartProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </CartProvider>
    </StoreProvider>
  ),
});
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { StoreProvider } from "@/app/store-provider";
import { CartProvider } from "@/app/cart-provider";
import { AuthProvider } from "@/app/auth-provider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "@/styles/app.css";

export const Route = createRootRoute({
  component: () => (
    <StoreProvider>
      <CartProvider>
        <AuthProvider>
          <>
            <SiteHeader />
            <Outlet />
            <SiteFooter />
          </>
        </AuthProvider>
      </CartProvider>
    </StoreProvider>
  ),
});`;

const CLEAN_ROOT = `import { Outlet, createRootRoute } from "@tanstack/react-router";
import { StoreProvider } from "@/app/store-provider";
import "@/styles/app.css";

export const Route = createRootRoute({
  component: () => (
    <StoreProvider>
      <Outlet />
    </StoreProvider>
  ),
});`;

const CLEAN_PAGE = `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  return <div>products</div>;
}`;

describe("detectAppendCorruption", () => {
  it("flags the reported corrupted __root.tsx (multiple export const Route)", () => {
    const reasons = detectAppendCorruption(CORRUPTED_ROOT);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some((r) => /export const Route/.test(r))).toBe(true);
  });

  it("passes a clean root route with a single declaration", () => {
    expect(detectAppendCorruption(CLEAN_ROOT)).toEqual([]);
  });

  it("passes a clean page route with a single createFileRoute", () => {
    expect(detectAppendCorruption(CLEAN_PAGE)).toEqual([]);
  });

  it("flags leaked apply_patch envelope markers", () => {
    const leaked = `*** Begin Patch\n*** Add File: src/x.ts\n+export const x = 1;\n*** End Patch`;
    const reasons = detectAppendCorruption(leaked);
    expect(reasons.some((r) => /patch marker/.test(r))).toBe(true);
  });

  it("flags duplicate createRootRoute even without duplicate export const", () => {
    const dup = `const a = createRootRoute({});\nconst b = createRootRoute({});`;
    const reasons = detectAppendCorruption(dup);
    expect(reasons.some((r) => /createRootRoute/.test(r))).toBe(true);
  });

  it("flags a module imported on 3+ distinct lines", () => {
    const dupImports = `import { a } from "@/x";\nimport { b } from "@/x";\nimport { c } from "@/x";\nexport const y = 1;`;
    const reasons = detectAppendCorruption(dupImports);
    expect(reasons.some((r) => /imported 3/.test(r))).toBe(true);
  });

  it("does NOT flag a normal file importing two different modules once each", () => {
    const ok = `import { a } from "@/x";\nimport { b } from "@/y";\nexport const z = 1;`;
    expect(detectAppendCorruption(ok)).toEqual([]);
  });
});
