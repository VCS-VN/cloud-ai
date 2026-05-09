import type { ProjectState, WebsiteSpec } from "../project/project-state.schema";
import { createInitialPackageJson } from "./package-json-generator";
import { resolvePackageRegistry, type PackageVersionOverride } from "./package-registry";
import type { TemplateId } from "./template-registry.server";
import { assertNormalizedWebsiteSpec, normalizeWebsiteSpec } from "../planning/extract-website-spec.server";
import { assertStorefrontImportAliases } from "./import-alias-validator";

export type GeneratedFile = { path: string; content: string };

export type InitSourceInput = {
  projectSlug: string;
  packageManager: ProjectState["stack"]["packageManager"];
  packageRegistryVersion: string;
  templateId: TemplateId;
  websiteSpec: WebsiteSpec;
  packageOverrides?: PackageVersionOverride[];
};

export async function initSource(input: InitSourceInput) {
  const websiteSpec = normalizeWebsiteSpec(input.websiteSpec, input.websiteSpec);
  assertNormalizedWebsiteSpec(websiteSpec);
  const packages = resolvePackageRegistry({ overrides: input.packageOverrides });
  const packageJson = createInitialPackageJson({ projectName: input.projectSlug, packageManager: input.packageManager, packages });
  const files = renderTemplateFiles(websiteSpec, packageJson);
  assertStorefrontImportAliases(files);
  return {
    files,
    projectStatePatch: {
      status: "initialized" as const,
      packagePolicy: {
        registryVersion: input.packageRegistryVersion,
        initializedPackages: packages.map(({ name, version, installType }) => ({ name, version, installType })),
      },
    } satisfies Partial<ProjectState>,
  };
}

function renderTemplateFiles(spec: WebsiteSpec, packageJson: unknown): GeneratedFile[] {
  const products = JSON.stringify(spec.products, null, 2);
  const categories = JSON.stringify(spec.store.type === "fashion" ? ["Sneakers", "Streetwear"] : ["Featured", "Essentials"], null, 2);
  const config = JSON.stringify({ store: spec.store, brand: spec.brand, content: spec.content }, null, 2);
  return [
    { path: "package.json", content: `${JSON.stringify(packageJson, null, 2)}\n` },
    { path: "vite.config.ts", content: `import { fileURLToPath, URL } from 'node:url'\nimport { defineConfig } from 'vite'\nimport { tanstackStart } from '@tanstack/react-start/plugin/vite'\nimport viteReact from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  resolve: {\n    alias: {\n      '@': fileURLToPath(new URL('./src', import.meta.url)),\n    },\n  },\n  plugins: [tanstackStart(), viteReact()],\n})\n` },
    { path: "tsconfig.json", content: `${JSON.stringify({ compilerOptions: { jsx: "react-jsx", moduleResolution: "Bundler", module: "ESNext", target: "ES2022", skipLibCheck: true, strictNullChecks: true, baseUrl: ".", paths: { "@/*": ["./src/*"] } } }, null, 2)}\n` },
    { path: "postcss.config.js", content: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n` },
    { path: "tailwind.config.ts", content: `import type { Config } from 'tailwindcss'\nexport default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] } satisfies Config\n` },
    { path: "index.html", content: `<div id="root"></div><script type="module" src="/src/router.tsx"></script>\n` },
    { path: "src/router.tsx", content: `import { createRouter } from "@tanstack/react-router";\nimport { routeTree } from "./routeTree.gen";\n\nexport function getRouter() {\n  return createRouter({\n    routeTree,\n    scrollRestoration: true,\n  });\n}\n\ndeclare module "@tanstack/react-router" {\n  interface Register {\n    router: ReturnType<typeof getRouter>;\n  }\n}\n` },
    { path: "src/routeTree.gen.ts", content: `export const routeTree = {} as never\n` },
    { path: "src/routes/__root.tsx", content: `import { Outlet, createRootRoute } from '@tanstack/react-router'\nimport { SiteHeader } from '@/components/layout/site-header'\nimport { SiteFooter } from '@/components/layout/site-footer'\n\nexport const Route = createRootRoute({ component: Root })\nfunction Root() { return <><SiteHeader /><Outlet /><SiteFooter /></> }\n` },
    { path: "src/routes/index.tsx", content: `import { createFileRoute } from '@tanstack/react-router'\nimport { HeroSection } from '@/components/store/hero-section'\nimport { ProductGrid } from '@/components/store/product-grid'\nimport { TrustSignals } from '@/components/store/trust-signals'\nexport const Route = createFileRoute('/')({ component: HomePage })\nfunction HomePage() { return <main><HeroSection /><ProductGrid /><TrustSignals /></main> }\n` },
    { path: "src/routes/products/route.tsx", content: `import { Outlet, createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/products')({ component: () => <Outlet /> })\n` },
    { path: "src/routes/products/index.tsx", content: `import { createFileRoute } from '@tanstack/react-router'\nimport { ProductGrid } from '@/components/store/product-grid'\nexport const Route = createFileRoute('/products/')({ component: ProductGrid })\n` },
    { path: "src/routes/products/$productId.tsx", content: `import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/products/$productId')({ component: ProductDetail })\nfunction ProductDetail() { const { productId } = Route.useParams(); return <main className="mx-auto max-w-5xl px-6 py-16"><h1 className="text-3xl font-semibold">Product {productId}</h1></main> }\n` },
    { path: "src/routes/cart.tsx", content: `import { createFileRoute } from '@tanstack/react-router'\nimport { CartDrawer } from '@/components/store/cart-drawer'\nexport const Route = createFileRoute('/cart')({ component: CartDrawer })\n` },
    { path: "src/routes/checkout.tsx", content: `import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/checkout')({ component: Checkout })\nfunction Checkout() { return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-3xl font-semibold">Mock checkout</h1><p>No real payment is processed.</p></main> }\n` },
    { path: "src/app/providers.tsx", content: `import type { PropsWithChildren } from 'react'\nimport { QueryClientProvider } from '@tanstack/react-query'\nimport { queryClient } from '@/app/query-client'\nexport function Providers({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }\n` },
    { path: "src/app/query-client.ts", content: `import { QueryClient } from '@tanstack/react-query'\nexport const queryClient = new QueryClient()\n` },
    { path: "src/components/layout/site-header.tsx", content: `import { HeadContent } from '@tanstack/react-router'\nimport { websiteConfig } from '@/lib/website-config'\nimport '@/styles/app.css'\n\nexport function SiteHeader() { return <header className="border-b px-6 py-4"><strong>{websiteConfig.store.name}</strong><HeadContent /></header> }\n` },
    { path: "src/components/layout/site-footer.tsx", content: `export function SiteFooter() { return <footer className="px-6 py-8 text-sm opacity-70">Built with AI Storefront Builder</footer> }\n` },
    { path: "src/components/store/hero-section.tsx", content: `import { websiteConfig } from '@/lib/website-config'\nexport function HeroSection() { return <section className="px-6 py-20"><h1 className="text-5xl font-bold">{websiteConfig.content.heroTitle}</h1><p className="mt-4 max-w-2xl text-lg">{websiteConfig.content.heroSubtitle}</p><a className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-white" href="/products">{websiteConfig.content.primaryCta}</a></section> }\n` },
    { path: "src/components/store/product-card.tsx", content: `import { formatMoney } from '@/lib/format-money'\nexport function ProductCard({ product }: { product: { name: string; price?: number; compareAtPrice?: number } }) { return <article className="rounded-3xl border p-4"><div className="aspect-square rounded-2xl bg-slate-100" /><h3 className="mt-4 font-semibold">{product.name}</h3><p>{formatMoney(product.price ?? 0)}</p>{product.compareAtPrice ? <span>Sale</span> : null}<button className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-white">Add to cart</button></article> }\n` },
    { path: "src/components/store/product-grid.tsx", content: `import { products } from '@/data/products'\nimport { ProductCard } from '@/components/store/product-card'\nexport function ProductGrid() { return <section className="grid gap-4 px-6 py-12 md:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</section> }\n` },
    { path: "src/components/store/category-section.tsx", content: `import { categories } from '@/data/categories'\nexport function CategorySection() { return <section>{categories.map((category) => <span key={category}>{category}</span>)}</section> }\n` },
    { path: "src/components/store/trust-signals.tsx", content: `import { websiteConfig } from '@/lib/website-config'\nexport function TrustSignals() { return <section className="grid gap-3 px-6 py-8 md:grid-cols-3">{websiteConfig.content.trustSignals.map((item) => <div className="rounded-2xl border p-4" key={item}>{item}</div>)}</section> }\n` },
    { path: "src/components/store/cart-drawer.tsx", content: `export function CartDrawer() { return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-3xl font-semibold">Cart</h1><p>Quantity, subtotal, and remove actions are ready for mock cart state.</p></main> }\n` },
    { path: "src/components/ui/button.tsx", content: `import type { ButtonHTMLAttributes } from 'react'\nexport function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={['rounded-full px-4 py-2 transition', props.className].filter(Boolean).join(' ')} /> }\n` },
    { path: "src/components/ui/input.tsx", content: `import type { InputHTMLAttributes } from 'react'\nexport function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={['rounded-xl border px-3 py-2', props.className].filter(Boolean).join(' ')} /> }\n` },
    { path: "src/components/ui/badge.tsx", content: `import type { PropsWithChildren } from 'react'\nexport function Badge({ children }: PropsWithChildren) { return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{children}</span> }\n` },
    { path: "src/data/products.ts", content: `export const products = ${products} as const\n` },
    { path: "src/data/categories.ts", content: `export const categories = ${categories} as const\n` },
    { path: "src/lib/cart-store.ts", content: `import { atom } from 'jotai'\nexport const cartItemsAtom = atom<Array<{ productId: string; quantity: number }>>([])\n` },
    { path: "src/lib/format-money.ts", content: `export function formatMoney(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) }\n` },
    { path: "src/lib/website-config.ts", content: `export const websiteConfig = ${config} as const\n` },
    { path: "src/styles/app.css", content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\n` },
  ];
}
