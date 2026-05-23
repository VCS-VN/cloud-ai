import type {
  ProjectState,
  WebsiteSpec,
} from "../project/project-state.schema";
import {
  assertNormalizedWebsiteSpec,
  normalizeWebsiteSpec,
} from "../planning/extract-website-spec.server";
import { assertStorefrontImportAliases } from "./import-alias-validator";
import { createInitialPackageJson } from "./package-json-generator";
import {
  resolvePackageRegistry,
  type PackageVersionOverride,
} from "./package-registry";
import type { TemplateId } from "./template-registry.server";

export type GeneratedFile = { path: string; content: string };

export type InitSourceInput = {
  projectSlug: string;
  packageManager: ProjectState["stack"]["packageManager"];
  packageRegistryVersion: string;
  templateId: TemplateId;
  websiteSpec: WebsiteSpec;
  packageOverrides?: PackageVersionOverride[];
};

export async function initInfrastructureSource(input: InitSourceInput) {
  const websiteSpec = normalizeWebsiteSpec(
    input.websiteSpec,
    input.websiteSpec,
  );
  assertNormalizedWebsiteSpec(websiteSpec);
  const packages = resolvePackageRegistry({
    overrides: input.packageOverrides,
  });
  const packageJson = createInitialPackageJson({
    projectName: input.projectSlug,
    packageManager: input.packageManager,
    packages,
  });
  const files = renderInfrastructureFiles(websiteSpec, packageJson);
  assertStorefrontImportAliases(files);
  return {
    files,
    projectStatePatch: {
      status: "initializing" as const,
      packagePolicy: {
        registryVersion: input.packageRegistryVersion,
        initializedPackages: packages.map(({ name, version, installType }) => ({
          name,
          version,
          installType,
        })),
      },
    } satisfies Partial<ProjectState>,
  };
}

export async function initSource(input: InitSourceInput) {
  const websiteSpec = normalizeWebsiteSpec(
    input.websiteSpec,
    input.websiteSpec,
  );
  assertNormalizedWebsiteSpec(websiteSpec);
  const packages = resolvePackageRegistry({
    overrides: input.packageOverrides,
  });
  const packageJson = createInitialPackageJson({
    projectName: input.projectSlug,
    packageManager: input.packageManager,
    packages,
  });
  const files = renderAllSourceFiles(websiteSpec, packageJson);
  assertStorefrontImportAliases(files);
  return {
    files,
    projectStatePatch: {
      status: "initialized" as const,
      packagePolicy: {
        registryVersion: input.packageRegistryVersion,
        initializedPackages: packages.map(({ name, version, installType }) => ({
          name,
          version,
          installType,
        })),
      },
    } satisfies Partial<ProjectState>,
  };
}

export function renderAllSourceFiles(
  spec: WebsiteSpec,
  packageJson: unknown,
): GeneratedFile[] {
  return [
    ...renderInfrastructureFiles(spec, packageJson),
    ...renderStorefrontBaselineFiles(spec),
  ];
}

export function renderInfrastructureFiles(
  spec: WebsiteSpec,
  packageJson: unknown,
): GeneratedFile[] {
  const products = JSON.stringify(
    spec.products.map((product) => {
      const { description, category, ...rest } = product;
      const next: Record<string, unknown> = { ...rest };
      if (description !== undefined) next.descriptions = description;
      if (typeof category === "string" && category.trim().length > 0) {
        const trimmed = category.trim();
        next.category = {
          id: trimmed
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
          name: trimmed,
        };
      } else if (category && typeof category === "object") {
        next.category = category;
      }
      return next;
    }),
    null,
    2,
  );
  const categories = JSON.stringify(
    spec.store.type === "fashion"
      ? ["Sneakers", "Streetwear"]
      : ["Featured", "Essentials"],
    null,
    2,
  );
  const config = JSON.stringify(
    { store: spec.store, brand: spec.brand, content: spec.content },
    null,
    2,
  );
  return [
    {
      path: "package.json",
      content: `${JSON.stringify(packageJson, null, 2)}\n`,
    },
    {
      path: ".env.example",
      content: renderEnvExampleSource(),
    },
    {
      path: "components.json",
      content: `${JSON.stringify({ $schema: "https://ui.shadcn.com/schema.json", style: "default", rsc: false, tsx: true, tailwind: { config: "tailwind.config.ts", css: "src/styles/app.css", baseColor: "neutral", cssVariables: true }, aliases: { components: "@/components", utils: "@/lib/utils" } }, null, 2)}\n`,
    },
    {
      path: "vite.config.ts",
      content: `import { fileURLToPath, URL } from 'node:url'\nimport { defineConfig } from 'vite'\nimport { tanstackStart } from '@tanstack/react-start/plugin/vite'\nimport viteReact from '@vitejs/plugin-react'\n\nconst previewHost = process.env.VITE_PREVIEW_HOST?.trim()\nconst previewPort = Number(process.env.VITE_PORT) || 5173\n\nexport default defineConfig({\n  resolve: {\n    alias: {\n      '@': fileURLToPath(new URL('./src', import.meta.url)),\n    },\n  },\n  server: {\n    host: '127.0.0.1',\n    port: previewPort,\n    strictPort: true,\n    allowedHosts: previewHost ? [previewHost] : true,\n    hmr: previewHost\n      ? { protocol: 'wss', host: previewHost, clientPort: 443 }\n      : true,\n  },\n  plugins: [tanstackStart(), viteReact()],\n})\n`,
    },
    {
      path: "tsconfig.json",
      content: `${JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          noEmit: true,
          types: ["node"],
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
            "@app/*": ["app/*"],
          },
          ignoreDeprecations: "6.0",
        },
        include: ["app", "src", "vite.config.ts", "tailwind.config.ts"],
      }, null, 2)}
`,
    },
    {
      path: "postcss.config.js",
      content: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from 'tailwindcss'\nimport { fontFamily } from "tailwindcss/defaultTheme"\n\nexport default {\n  darkMode: ["class"],\n  content: ['./index.html', './src/**/*.{ts,tsx}'],\n  theme: {\n    extend: {\n      colors: {\n        border: "var(--border)", input: "var(--input)", ring: "var(--ring)", background: "var(--background)", foreground: "var(--foreground)",\n        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" }, secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" }, destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" }, muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" }, accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" }, popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" }, card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" }, highlight: { DEFAULT: "var(--highlight)", foreground: "var(--highlight-foreground)" }, deep: { DEFAULT: "var(--deep)", foreground: "var(--deep-foreground)" }, success: "var(--success)", warning: "var(--warning)", error: "var(--error)",\n      },\n      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },\n      fontFamily: { sans: ["Inter", "Manrope", ...fontFamily.sans] },\n    },\n  },\n  plugins: [],\n} satisfies Config\n`,
    },
    {
      path: "src/router.tsx",
      content: `import { createRouter } from "@tanstack/react-router";\nimport { routeTree } from "./routeTree.gen";\n\nexport function getRouter() {\n  return createRouter({ routeTree, scrollRestoration: true });\n}\n\ndeclare module "@tanstack/react-router" {\n  interface Register { router: ReturnType<typeof getRouter>; }\n}\n`,
    },
    {
      path: "src/routeTree.gen.ts",
      content: `export const routeTree = {} as never\n`,
    },
    {
      path: "src/app/providers.tsx",
      content: `import type { PropsWithChildren } from 'react'\nimport { QueryClientProvider } from '@tanstack/react-query'\nimport { queryClient } from '@/app/query-client'\n\nexport function Providers({ children }: PropsWithChildren) {\n  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>\n}\n`,
    },
    {
      path: "src/app/query-client.ts",
      content: `import { QueryClient } from '@tanstack/react-query'\nexport const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true } } })\n`,
    },
    {
      path: "src/data/products.ts",
      content: `export const products = ${products} as const\n\nexport type Product = (typeof products)[number]\n`,
    },
    {
      path: "src/data/categories.ts",
      content: `export const categories = ${categories} as const\n`,
    },
    {
      path: "src/lib/format-money.ts",
      content: `import lodash from 'lodash'
import type { Product } from '@/services/store/use-products-list'

export type FormatMoneyOptions = {
  currency?: string
}

export function formatMoney(valueInCents: number | null | undefined, options: FormatMoneyOptions = {}) {
  const currency = options.currency || 'AUD'
  const amount = lodash.round(lodash.divide(Number(valueInCents ?? 0), 100), 2)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function resolveProductPrice(product: Product | null | undefined): number | undefined {
  if (!product) return undefined
  const fromDefault = lodash.get(product, 'defaultModel.price') as number | undefined
  if (typeof fromDefault === 'number') return fromDefault
  const fromFirstModel = lodash.get(product, 'models[0].price') as number | undefined
  if (typeof fromFirstModel === 'number') return fromFirstModel
  return lodash.get(product, 'price') as number | undefined
}
`,
    },
    {
      path: "src/lib/website-config.ts",
      content: `export const websiteConfig = ${config} as const\n`,
    },
    {
      path: "src/lib/utils.ts",
      content: `import { type ClassValue, clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n`,
    },
    { path: "src/styles/app.css", content: appCssSource() },
    { path: "src/vite-env.d.ts", content: `/// <reference types="vite/client" />
` },
    { path: "src/services/http/client.ts", content: renderHttpClientSource() },
  ];
}

export function renderHttpClientSource(): string {
  return `import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

type ApiErrorPayload = {
  message?: unknown
  error?: unknown
  errors?: unknown
  code?: unknown
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

function getErrorMessage(payload: ApiErrorPayload | undefined, fallback: string) {
  if (!payload) return fallback

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim()
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }

  if (Array.isArray(payload.errors) && typeof payload.errors[0] === 'string') {
    return payload.errors[0]
  }

  return fallback
}

function getStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

export function getAccessToken() {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null
}

export function getRefreshToken() {
  return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null
}

export function setAuthTokens(tokens: AuthTokens) {
  const storage = getStorage()
  storage?.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  storage?.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearAuthTokens() {
  const storage = getStorage()
  storage?.removeItem(ACCESS_TOKEN_KEY)
  storage?.removeItem(REFRESH_TOKEN_KEY)
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || undefined
}

export class ApiError extends Error {
  status?: number
  code?: string
  details?: unknown

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details
  }
}

function withDefaultHeaders(config: InternalAxiosRequestConfig) {
  config.timeout = config.timeout ?? 10000
  config.headers.set('Accept', 'application/json')

  if (config.data !== undefined && !config.headers.has('Content-Type')) {
    config.headers.set('Content-Type', 'application/json')
  }

  if (!config.headers.has('Authorization')) {
    const accessToken = getAccessToken()
    if (accessToken) {
      config.headers.set('Authorization', \`Bearer \${accessToken}\`)
    }
  }

  return config
}

export function toApiError(error: unknown) {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const responseData =
      typeof error.response?.data === 'object' && error.response.data
        ? (error.response.data as ApiErrorPayload)
        : undefined

    return new ApiError(
      getErrorMessage(responseData, error.message || 'Something went wrong while calling the API.'),
      {
        status: error.response?.status,
        code: typeof responseData?.code === 'string' ? responseData.code : error.code,
        details: error.response?.data,
      },
    )
  }

  if (error instanceof Error) return new ApiError(error.message)

  return new ApiError('Something went wrong while calling the API.')
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  _skipAuthRefresh?: boolean
}

export const apiClient = axios.create()

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

apiClient.interceptors.request.use(withDefaultHeaders)

type RefreshTokenResponse = AuthTokens

let refreshPromise: Promise<AuthTokens> | null = null

function isRefreshRequest(config: InternalAxiosRequestConfig | undefined) {
  const url = config?.url ?? ''
  return typeof url === 'string' && url.includes('/api/v1/auth/refresh-token')
}

async function refreshAuthTokens(): Promise<AuthTokens> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    clearAuthTokens()
    throw new ApiError('Your session has expired. Please log in again.', { status: 401 })
  }

  const response = await apiClient.get<RefreshTokenResponse>('/api/v1/auth/refresh-token', {
    headers: { Authorization: \`Bearer \${refreshToken}\` },
    _skipAuthRefresh: true,
  } as RetriableRequestConfig)

  if (response.data?.accessToken && response.data?.refreshToken) {
    setAuthTokens({ accessToken: response.data.accessToken, refreshToken: response.data.refreshToken })
  }

  return response.data
}

async function refreshAuthTokensOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshAuthTokens()
  }

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(toApiError(error))
    }

    const config = error.config as RetriableRequestConfig | undefined
    const status = error.response?.status

    if (!config || status !== 401) {
      return Promise.reject(toApiError(error))
    }

    if (config._skipAuthRefresh) {
      if (isRefreshRequest(config)) clearAuthTokens()
      return Promise.reject(toApiError(error))
    }

    if (config._retry || isRefreshRequest(config)) {
      if (isRefreshRequest(config)) clearAuthTokens()
      return Promise.reject(toApiError(error))
    }

    const refreshToken = getRefreshToken()

    if (!refreshToken) {
      clearAuthTokens()
      return Promise.reject(toApiError(error))
    }

    try {
      config._retry = true
      const tokens = await refreshAuthTokensOnce()
      config.headers.set('Authorization', \`Bearer \${tokens.accessToken}\`)
      return await apiClient.request(config)
    } catch (refreshError) {
      const apiError = toApiError(refreshError)
      if (apiError.status === 401) clearAuthTokens()
      return Promise.reject(apiError)
    }
  },
)
`;
}

export function renderEnvSource(): string {
  return `VITE_API_BASE_URL=https://customer-api.myepis.cloud
`;
}

export function renderEnvExampleSource(): string {
  return `# Backend API endpoint used by src/services/http/client.ts
VITE_API_BASE_URL=https://customer-api.myepis.cloud
`;
}

export function renderStorefrontBaselineFiles(
  spec: WebsiteSpec,
): GeneratedFile[] {
  return [
    { path: "src/app/store-provider.tsx", content: storeProviderSource() },
    { path: "src/app/cart-provider.tsx", content: cartProviderSource() },
    { path: "src/data/sample-store.ts", content: sampleStoreSource(spec) },
    { path: "src/components/ui/button.tsx", content: buttonSource() },
    { path: "src/components/ui/input.tsx", content: inputSource() },
    { path: "src/components/ui/select.tsx", content: selectSource() },
    { path: "src/components/ui/radio-group.tsx", content: radioGroupSource() },
    { path: "src/components/ui/dialog.tsx", content: dialogSource() },
    { path: "src/components/ui/sheet.tsx", content: sheetSource() },
    { path: "src/components/ui/sonner.tsx", content: sonnerSource() },
    { path: "src/components/ui/badge.tsx", content: badgeSource() },
    { path: "src/components/ui/card.tsx", content: cardSource() },
    {
      path: "src/components/layout/route-loading-bar.tsx",
      content: routeLoadingBarSource(),
    },
    {
      path: "src/components/layout/site-header.tsx",
      content: siteHeaderSource(),
    },
    {
      path: "src/components/layout/site-footer.tsx",
      content: siteFooterSource(),
    },
    {
      path: "src/components/store/hero-section.tsx",
      content: heroSectionSource(),
    },
    {
      path: "src/components/store/product-card.tsx",
      content: productCardSource(),
    },
    {
      path: "src/components/store/product-grid.tsx",
      content: productGridSource(),
    },
    {
      path: "src/components/store/trust-signals.tsx",
      content: trustSignalsSource(),
    },
    {
      path: "src/components/store/category-section.tsx",
      content: categorySectionSource(),
    },
    {
      path: "src/components/store/cart-drawer.tsx",
      content: cartDrawerSource(),
    },
    { path: "src/components/store/cart-item.tsx", content: cartItemSource() },
    { path: "src/components/store/order-card.tsx", content: orderCardSource() },
    { path: "src/components/store/not-found.tsx", content: notFoundSource() },
    { path: "src/components/store/store-detail-error.tsx", content: storeDetailErrorSource() },
    { path: "src/services/store/use-store-detail.ts", content: storeDetailQuerySource() },
    { path: "src/services/store/use-products-list.ts", content: productsListQuerySource() },
    { path: "src/services/store/use-product-detail.ts", content: productDetailQuerySource() },
    { path: "src/services/store/use-categories-list.ts", content: categoriesListQuerySource() },
    { path: "src/services/store/use-product-suggestions.ts", content: productSuggestionsQuerySource() },
    { path: "src/routes/__root.tsx", content: rootRouteSource() },
    { path: "src/routes/index.tsx", content: homeRouteSource() },
    {
      path: "src/routes/products/route.tsx",
      content: productsLayoutRouteSource(),
    },
    {
      path: "src/routes/products/index.tsx",
      content: productsIndexRouteSource(),
    },
    {
      path: "src/routes/products/$productId.tsx",
      content: productDetailRouteSource(),
    },
    { path: "src/routes/cart.tsx", content: cartRouteSource() },
    { path: "src/routes/checkout.tsx", content: checkoutRouteSource() },
    { path: "src/routes/orders/index.tsx", content: ordersIndexRouteSource() },
    {
      path: "src/routes/orders/$orderId.tsx",
      content: orderDetailRouteSource(),
    },
  ];
}

function storeDetailErrorSource() {
  return `import { Button } from '@/components/ui/button'

type StoreDetailErrorProps = {
  message?: string
  onRetry: () => void
}

export function StoreDetailError({ message, onRetry }: StoreDetailErrorProps) {
  return (
    <section className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-foreground shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-destructive">Store unavailable</p>
        <h2 className="text-2xl font-semibold tracking-tight">We could not load this store.</h2>
        <p className="text-sm text-muted-foreground">{message ?? 'Real store data failed to load. Try again to refetch the store detail.'}</p>
        <Button type="button" onClick={onRetry}>Retry store data</Button>
      </div>
    </section>
  )
}
`;
}

function storeDetailQuerySource() {
  return `import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/http/client'

export type StoreSetting = {
  currency?: string
  [key: string]: unknown
}

export type StoreDetail = {
  id: string
  slug: string
  name: string
  description?: string
  setting?: StoreSetting
  [key: string]: unknown
}

export const storeSlug = import.meta.env.VITE_STORE_SLUG?.trim() || ''
export const hasStoreSlug = storeSlug.length > 0

export async function getStoreDetail(slug = storeSlug) {
  const response = await apiClient.get<StoreDetail>(\`/api/v1/stores/\${slug}\`)
  return response.data
}

export function useStoreDetail() {
  return useQuery({
    queryKey: ['store-detail', storeSlug],
    queryFn: () => getStoreDetail(storeSlug),
    enabled: hasStoreSlug,
    retry: 1,
  })
}
`;
}

function productsListQuerySource() {
  return `import { useInfiniteQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/http/client'
import { hasStoreSlug } from '@/services/store/use-store-detail'
import { products as sampleProducts } from '@/data/products'

export const PRODUCTS_PAGE_SIZE = 12

export type ProductModel = {
  id?: string
  price?: number
  [key: string]: unknown
}

export type Product = {
  id: string
  entityId?: string
  name: string
  descriptions?: string
  price?: number
  compareAtPrice?: number
  image?: string
  images?: string[]
  category?: { id: string; name: string }
  defaultModel?: ProductModel
  models?: ProductModel[]
  [key: string]: unknown
}

export type ProductsList = {
  total: number
  data: Product[]
}

type ProductsListParams = {
  storeId?: string
  query?: string
}

const sampleProductsArray = sampleProducts as unknown as Product[]

export type UseProductsListResult = {
  products: Product[]
  total: number
  fetchNextPage: () => Promise<unknown>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export async function getProductsList(params: ProductsListParams & { page: number; limit: number }) {
  const response = await apiClient.get<ProductsList>('/api/v1/products', { params })
  return response.data
}

export function useProductsList(params: ProductsListParams = {}): UseProductsListResult {
  const query = useInfiniteQuery({
    queryKey: ['products-list', params],
    queryFn: ({ pageParam }) =>
      getProductsList({ ...params, page: pageParam as number, limit: PRODUCTS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
    enabled: hasStoreSlug && Boolean(params.storeId),
  })

  if (!hasStoreSlug) {
    const trimmed = params.query?.trim().toLowerCase() ?? ''
    const filtered = trimmed
      ? sampleProductsArray.filter((product) =>
          (product.name ?? '').toLowerCase().includes(trimmed),
        )
      : sampleProductsArray
    return {
      products: filtered,
      total: filtered.length,
      fetchNextPage: () => Promise.resolve(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve(),
    }
  }

  const products = query.data?.pages.flatMap((page) => page.data) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  return {
    products,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
`;
}

function productDetailQuerySource() {
  return `import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/services/http/client'
import { hasStoreSlug, type StoreDetail } from '@/services/store/use-store-detail'
import { products as sampleProducts } from '@/data/products'
import type { Product } from '@/services/store/use-products-list'

export type ProductDetail = Product & {
  store?: StoreDetail
  [key: string]: unknown
}

export async function getProductDetail(productId: string) {
  const response = await apiClient.get<ProductDetail>(\`/api/v1/products/\${productId}\`, {
    params: {
      isGettingModels: true,
      isGettingDefaultModel: true,
    },
  })
  return response.data
}

export function useProductDetail(productId?: string): UseQueryResult<ProductDetail> {
  const query = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => getProductDetail(productId ?? ''),
    enabled: hasStoreSlug && Boolean(productId),
  })
  if (!hasStoreSlug) {
    const list = sampleProducts as unknown as Product[]
    const fallback = (list.find((p) => p.id === productId) ?? list[0]) as ProductDetail
    return {
      data: fallback,
      isLoading: false,
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      status: 'success',
      refetch: () => Promise.resolve({ data: fallback } as never),
    } as unknown as UseQueryResult<ProductDetail>
  }
  return query
}
`;
}

function categoriesListQuerySource() {
  return `import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/services/http/client'
import { hasStoreSlug } from '@/services/store/use-store-detail'
import { categories as sampleCategoryNames } from '@/data/categories'

export type Category = {
  id: string
  name: string
  storeId?: string
  [key: string]: unknown
}

export type CategoriesList = {
  total: number
  data: Category[]
}

const sampleCategoriesList: CategoriesList = {
  total: sampleCategoryNames.length,
  data: (sampleCategoryNames as readonly string[]).map((name, index) => ({
    id: \`sample-category-\${index}\`,
    name,
  })),
}

export async function getCategoriesList(storeId?: string) {
  const response = await apiClient.get<CategoriesList>('/api/v1/categories', {
    params: { storeId },
  })
  return response.data
}

export function useCategoriesList(storeId?: string): UseQueryResult<CategoriesList> {
  const query = useQuery({
    queryKey: ['categories-list', storeId],
    queryFn: () => getCategoriesList(storeId),
    enabled: hasStoreSlug && Boolean(storeId),
  })
  if (!hasStoreSlug) {
    return {
      data: sampleCategoriesList,
      isLoading: false,
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      status: 'success',
      refetch: () => Promise.resolve({ data: sampleCategoriesList } as never),
    } as unknown as UseQueryResult<CategoriesList>
  }
  return query
}
`;
}

export function hasSiteHeaderSearchSuggestionContract(source: string) {
  const requiredMarkers = [
    "useProductSuggestions",
    "site-search-suggestions",
    "role='combobox'",
    "role='listbox'",
    "showDropdown",
    "suggestions.map",
    "onMouseDown={(event) =>",
    "event.preventDefault()",
  ];
  return requiredMarkers.every((marker) => source.includes(marker));
}

export function productSuggestionsQuerySource() {
  return `import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/http/client'
import { hasStoreSlug } from '@/services/store/use-store-detail'
import { products as sampleProducts } from '@/data/products'

export type ProductSuggestionsList = {
  total: number
  data: string[]
}

type ProductSuggestionsParams = {
  storeId?: string
  query?: string
}

const SUGGESTIONS_LIMIT = 8

const sampleNamePool = Array.from(
  new Set(
    (sampleProducts as Array<{ name?: string }>)
      .map((product) => product.name?.trim() ?? '')
      .filter((name) => name.length > 0),
  ),
)

function buildSampleSuggestions(query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return [] as string[]
  return sampleNamePool
    .filter((name) => name.toLowerCase().includes(trimmed))
    .slice(0, SUGGESTIONS_LIMIT)
}

export type UseProductSuggestionsResult = {
  suggestions: string[]
  total: number
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export async function getProductSuggestions(params: { storeId?: string; query: string }) {
  const response = await apiClient.get<ProductSuggestionsList>(
    '/api/v1/products/suggestions',
    { params },
  )
  const data = response.data
  if (!Array.isArray(data?.data)) {
    if (import.meta.env.DEV) {
      console.info('[storefront] product suggestions response had no data array')
    }
    return { total: 0, data: [] }
  }
  return { total: typeof data.total === 'number' ? data.total : data.data.length, data: data.data }
}

export function useProductSuggestions(
  params: ProductSuggestionsParams = {},
): UseProductSuggestionsResult {
  const trimmed = (params.query ?? '').trim()
  const enabled = hasStoreSlug && Boolean(params.storeId) && trimmed.length > 0
  const query = useQuery({
    queryKey: ['product-suggestions', params.storeId, trimmed],
    queryFn: () => getProductSuggestions({ storeId: params.storeId, query: trimmed }),
    enabled,
  })

  if (!hasStoreSlug || trimmed.length === 0) {
    const matched = buildSampleSuggestions(trimmed)
    return {
      suggestions: matched,
      total: matched.length,
      isLoading: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve(),
    }
  }

  const suggestions = query.data?.data ?? []
  return {
    suggestions,
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
`;
}

function appCssSource() {
  return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n@layer base {\n  /* DESIGN_TOKENS_START */
  :root {
    --background: #F7F9FC; --foreground: #111827; --card: #FFFFFF; --card-foreground: #111827; --popover: #FFFFFF; --popover-foreground: #111827; --primary: #1746A2; --primary-foreground: #FFFFFF; --secondary: #E9EEF6; --secondary-foreground: #111827; --muted: #E9EEF6; --muted-foreground: #4B5563; --accent: #E85D04; --accent-foreground: #FFFFFF; --destructive: #B91C1C; --destructive-foreground: #FFFFFF; --border: #CBD5E1; --input: #CBD5E1; --ring: #1746A2; --highlight: #F4B400; --highlight-foreground: #1F1300; --success: #166534; --warning: #92400E; --error: #B91C1C; --radius: 0.75rem;
  }
  /* DESIGN_TOKENS_END */\n  * { @apply border-border; }\n  body { @apply bg-background text-foreground; margin: 0; font-family: Inter, Manrope, system-ui, -apple-system, sans-serif; }\n}\n`;
}
function buttonSource() {
  return `import * as React from 'react'\nimport { Slot } from '@radix-ui/react-slot'\nimport { cva, type VariantProps } from 'class-variance-authority'\nimport { cn } from '@/lib/utils'\n\nconst buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition active:scale-95 disabled:pointer-events-none disabled:opacity-50', { variants: { variant: { default: 'bg-primary text-primary-foreground hover:bg-primary/90', destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90', outline: 'border border-input bg-background hover:bg-accent', secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80', ghost: 'hover:bg-accent', link: 'text-primary underline-offset-4 hover:underline' }, size: { default: 'h-10 px-4 py-2', sm: 'h-9 px-3', lg: 'h-11 px-8', icon: 'h-10 w-10' } }, defaultVariants: { variant: 'default', size: 'default' } })\n\nexport interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }\nexport const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => { const Comp = asChild ? Slot : 'button'; return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} /> })\nButton.displayName = 'Button'\nexport { buttonVariants }\n`;
}
function inputSource() {
  return `import * as React from 'react'\nimport { cn } from '@/lib/utils'\n\nexport const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (\n  <input type={type} className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)} ref={ref} {...props} />\n))\nInput.displayName = 'Input'\n`;
}
function badgeSource() {
  return `import { cva, type VariantProps } from 'class-variance-authority'\nimport { cn } from '@/lib/utils'\n\nconst badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors', { variants: { variant: { default: 'border-transparent bg-primary text-primary-foreground', secondary: 'border-transparent bg-secondary text-secondary-foreground', destructive: 'border-transparent bg-destructive text-destructive-foreground', outline: 'text-foreground', sale: 'border-transparent bg-amber-600 text-white' } }, defaultVariants: { variant: 'default' } })\nexport function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) { return <div className={cn(badgeVariants({ variant }), className)} {...props} /> }\n`;
}
function cardSource() {
  return `import * as React from 'react'\nimport { cn } from '@/lib/utils'\nexport const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />)\nexport const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />)\nexport const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />)\nexport const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />)\nexport const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />)\nexport const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />)\nCard.displayName = 'Card'; CardHeader.displayName = 'CardHeader'; CardTitle.displayName = 'CardTitle'; CardDescription.displayName = 'CardDescription'; CardContent.displayName = 'CardContent'; CardFooter.displayName = 'CardFooter'\n`;
}
function selectSource() {
  return `import * as SelectPrimitive from '@radix-ui/react-select'\nimport { Check, ChevronDown } from 'lucide-react'\nimport { cn } from '@/lib/utils'\nexport const Select = SelectPrimitive.Root\nexport const SelectValue = SelectPrimitive.Value\nexport const SelectTrigger = ({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) => <SelectPrimitive.Trigger className={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring', className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown className='h-4 w-4 opacity-50' /></SelectPrimitive.Icon></SelectPrimitive.Trigger>\nexport const SelectContent = ({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) => <SelectPrimitive.Portal><SelectPrimitive.Content className={cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md', className)} {...props}><SelectPrimitive.Viewport className='p-1'>{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>\nexport const SelectItem = ({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) => <SelectPrimitive.Item className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent', className)} {...props}><span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'><SelectPrimitive.ItemIndicator><Check className='h-4 w-4' /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>\n`;
}
function radioGroupSource() {
  return `import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'\nimport { Circle } from 'lucide-react'\nimport { cn } from '@/lib/utils'\nexport const RadioGroup = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>) => <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} />\nexport const RadioGroupItem = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>) => <RadioGroupPrimitive.Item className={cn('aspect-square h-4 w-4 rounded-full border border-primary text-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50', className)} {...props}><RadioGroupPrimitive.Indicator className='flex items-center justify-center'><Circle className='h-2.5 w-2.5 fill-current text-current' /></RadioGroupPrimitive.Indicator></RadioGroupPrimitive.Item>\n`;
}
function dialogSource() {
  return `import * as DialogPrimitive from '@radix-ui/react-dialog'\nimport { X } from 'lucide-react'\nimport { cn } from '@/lib/utils'\nexport const Dialog = DialogPrimitive.Root\nexport const DialogTrigger = DialogPrimitive.Trigger\nexport const DialogClose = DialogPrimitive.Close\nexport const DialogPortal = DialogPrimitive.Portal\nexport const DialogOverlay = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) => <DialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/60', className)} {...props} />\nexport const DialogContent = ({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) => <DialogPortal><DialogOverlay /><DialogPrimitive.Content className={cn('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg', className)} {...props}>{children}<DialogPrimitive.Close className='absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100'><X className='h-4 w-4' /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPortal>\nexport const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />\nexport const DialogTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) => <DialogPrimitive.Title className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />\nexport const DialogDescription = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) => <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />\n`;
}

function sheetSource() {
  return `import { Drawer as SheetPrimitive } from 'vaul'
import { cn } from '@/lib/utils'

export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close
export const SheetPortal = SheetPrimitive.Portal
export const SheetOverlay = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>) => (
  <SheetPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/60', className)} {...props} />
)
export const SheetContent = ({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[85vh] flex-col rounded-t-2xl border bg-background p-5 shadow-xl outline-none',
        className,
      )}
      {...props}
    >
      <div className='mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted' aria-hidden />
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
)
export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
)
export const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-4 flex flex-col gap-2', className)} {...props} />
)
export const SheetTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>) => (
  <SheetPrimitive.Title className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
)
export const SheetDescription = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>) => (
  <SheetPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
)
`;
}
function sonnerSource() {
  return `import { Toaster as Sonner } from 'sonner'\nexport function Toaster() { return <Sonner richColors position='top-right' /> }\n`;
}
function sampleStoreSource(spec: WebsiteSpec) {
  const sample = JSON.stringify(
    {
      id: "sample-store",
      slug: "sample-store",
      name: spec.store.name,
      description: spec.store.description,
      setting: {
        currency: "AUD",
      },
    },
    null,
    2,
  );
  return `import type { StoreDetail } from '@/services/store/use-store-detail'

export const sampleStore: StoreDetail = ${sample}
`;
}
function storeProviderSource() {
  return `import type { PropsWithChildren } from 'react'
import { createContext, useContext, useMemo } from 'react'
import { useStoreDetail, hasStoreSlug, type StoreDetail } from '@/services/store/use-store-detail'
import { sampleStore } from '@/data/sample-store'

type StoreContextValue = {
  storeDetail: StoreDetail
  isLoading: boolean
  error: unknown
  refetch: () => void
  isUsingSampleData: boolean
}

const StoreContext = createContext<StoreContextValue | null>(null)
const NOOP = () => {}

export function StoreProvider({ children }: PropsWithChildren) {
  const query = useStoreDetail()
  const value = useMemo<StoreContextValue>(() => {
    if (!hasStoreSlug) {
      return { storeDetail: sampleStore, isLoading: false, error: null, refetch: NOOP, isUsingSampleData: true }
    }
    return {
      storeDetail: query.data ?? sampleStore,
      isLoading: query.isLoading,
      error: query.error,
      refetch: () => { void query.refetch() },
      isUsingSampleData: !query.data,
    }
  }, [query.data, query.error, query.isLoading, query.refetch])

  if (hasStoreSlug && query.isLoading) {
    return (
      <div className='min-h-screen bg-background px-4 py-10'>
        <div className='mx-auto max-w-7xl space-y-8'>
          <div className='flex items-center justify-between gap-4'>
            <div className='h-8 w-40 animate-pulse rounded bg-muted/60' />
            <div className='hidden gap-3 md:flex'>
              <div className='h-5 w-20 animate-pulse rounded bg-muted/50' />
              <div className='h-5 w-20 animate-pulse rounded bg-muted/50' />
              <div className='h-5 w-20 animate-pulse rounded bg-muted/50' />
            </div>
          </div>
          <div className='grid gap-8 lg:grid-cols-[1.1fr_0.9fr]'>
            <div className='space-y-4'>
              <div className='h-5 w-32 animate-pulse rounded bg-muted/50' />
              <div className='h-16 w-full max-w-xl animate-pulse rounded bg-muted/60' />
              <div className='h-5 w-full max-w-lg animate-pulse rounded bg-muted/50' />
              <div className='h-5 w-2/3 animate-pulse rounded bg-muted/50' />
            </div>
            <div className='h-80 animate-pulse rounded-[2rem] bg-muted/50' />
          </div>
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='h-72 animate-pulse rounded-lg border bg-muted/40' />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (hasStoreSlug && query.isError) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background px-4 py-10'>
        <div className='max-w-md rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-destructive'>Store unavailable</p>
          <h1 className='mt-2 text-2xl font-semibold'>We could not load this store.</h1>
          <p className='mt-2 text-sm text-muted-foreground'>Please retry the store request.</p>
          <button type='button' className='mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground' onClick={() => { void query.refetch() }}>Retry</button>
        </div>
      </div>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within StoreProvider')
  return context
}
`;
}
function cartProviderSource() {
  return `import type { PropsWithChildren } from 'react'
import { createContext, useContext } from 'react'

export type CartContextValue = Record<string, never>

const EMPTY_CART_VALUE: CartContextValue = Object.freeze({}) as CartContextValue
const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: PropsWithChildren) {
  return <CartContext.Provider value={EMPTY_CART_VALUE}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
`;
}
export function rootRouteSource() {
  return `import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { Providers } from '@/app/providers'
import { StoreProvider } from '@/app/store-provider'
import { CartProvider } from '@/app/cart-provider'
import { RouteLoadingBar } from '@/components/layout/route-loading-bar'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { NotFound } from '@/components/store/not-found'
import { Toaster } from '@/components/ui/sonner'
import '@/styles/app.css'

export const Route = createRootRoute({ component: Root, notFoundComponent: NotFound })
function Root() {
  return (
    <html lang='en'>
      <head><HeadContent /></head>
      <body>
        <Providers>
          <StoreProvider>
            <CartProvider>
              <RouteLoadingBar />
              <SiteHeader />
              <Outlet />
              <SiteFooter />
              <Toaster />
            </CartProvider>
          </StoreProvider>
        </Providers>
        <Scripts />
      </body>
    </html>
  )
}
`;
}
export function ensureRootRouteLoadingBarContract(source: string) {
  if (/<RouteLoadingBar\b/.test(source)) return source;
  let nextSource = source;
  if (!nextSource.includes("@/components/layout/route-loading-bar")) {
    const siteHeaderImport = "import { SiteHeader } from '@/components/layout/site-header'";
    nextSource = nextSource.includes(siteHeaderImport)
      ? nextSource.replace(siteHeaderImport, `import { RouteLoadingBar } from '@/components/layout/route-loading-bar'\n${siteHeaderImport}`)
      : `import { RouteLoadingBar } from '@/components/layout/route-loading-bar'\n${nextSource}`;
  }
  return nextSource.replace(
    /(\s*)<SiteHeader\s*\/>/,
    "$1<RouteLoadingBar />$1<SiteHeader />",
  );
}
export function routeLoadingBarSource() {
  return `import { useRouterState } from '@tanstack/react-router'

export function RouteLoadingBar() {
  const status = useRouterState({ select: (state) => state.status })
  const visible = status === 'pending'

  return (
    <div
      role='progressbar'
      aria-hidden={!visible}
      className='pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-transparent'
    >
      <div
        className={\`h-full w-full bg-primary transition-all duration-300 ease-out \${visible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}\`}
      />
    </div>
  )
}
`;
}
export function notFoundSource() {
  return `import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function NotFound() {
  return (
    <main className='mx-auto flex min-h-[60vh] max-w-5xl items-center px-4 py-16'>
      <Card className='w-full border-border bg-card text-card-foreground'>
        <CardContent className='grid gap-6 p-8 text-center md:p-12'>
          <SearchX aria-hidden='true' className='mx-auto h-12 w-12 text-primary' />
          <div className='mx-auto max-w-2xl space-y-3'>
            <h1 className='text-3xl font-bold tracking-tight md:text-5xl'>Page not found</h1>
            <p className='text-muted-foreground'>This preview path does not exist yet. Return to the storefront or browse products.</p>
          </div>
          <div className='flex flex-col justify-center gap-3 sm:flex-row'>
            <Button asChild><Link to='/'>Go home</Link></Button>
            <Button asChild variant='outline'><Link to='/products'>View products</Link></Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
`;
}
export function siteHeaderSource() {
  return `import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Search, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/app/store-provider'
import { useProductSuggestions } from '@/services/store/use-product-suggestions'

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')
}

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>
  const parts = text.split(new RegExp('(' + escapeRegExp(trimmed) + ')', 'gi'))
  const lowered = trimmed.toLowerCase()
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === lowered ? (
          <span key={index} className='text-primary'>{part}</span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

export function SiteHeader() {
  const navigate = useNavigate()
  const { storeDetail } = useStore()
  const storeId = storeDetail?.id
  const [inputValue, setInputValue] = useState('')
  const [debouncedValue, setDebouncedValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(inputValue), 800)
    return () => window.clearTimeout(timer)
  }, [inputValue])

  const { suggestions, isError } = useProductSuggestions({ storeId, query: debouncedValue })
  const trimmed = inputValue.trim()
  const showDropdown = open && trimmed.length > 0 && suggestions.length > 0 && !isError

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.info('[storefront] search suggestions state', {
      inputLength: inputValue.length,
      debouncedLength: debouncedValue.length,
      suggestionsCount: suggestions.length,
      open,
    })
  }, [inputValue.length, debouncedValue.length, suggestions.length, open])

  useEffect(() => {
    if (!showDropdown) return
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  useEffect(() => {
    setActiveIndex(-1)
  }, [inputValue, suggestions.length])

  const submitQuery = (next: string) => {
    const query = next.trim()
    if (!query) return
    setOpen(false)
    setActiveIndex(-1)
    void navigate({ to: '/products', search: { q: query } })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitQuery(inputValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
      return
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1,
      )
      return
    }
    if (event.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault()
        const picked = suggestions[activeIndex]
        setInputValue(picked)
        submitQuery(picked)
      }
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    submitQuery(suggestion)
  }

  return (
    <header className='sticky top-0 z-40 border-b bg-background/95 backdrop-blur'>
      <div className='mx-auto flex h-16 max-w-7xl items-center gap-4 px-4'>
        <Link to='/' className='shrink-0 text-lg font-bold'>
          {storeDetail?.name}
        </Link>
        <div ref={wrapperRef} className='relative flex-1'>
          <form onSubmit={handleSubmit} className='relative w-full'>
            <Search
              aria-hidden='true'
              className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40'
            />
            <input
              type='search'
              role='combobox'
              aria-expanded={showDropdown}
              aria-controls='site-search-suggestions'
              aria-autocomplete='list'
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder='What are you looking for?'
              className='h-11 w-full rounded-full border-0 bg-primary/5 pl-11 pr-12 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30'
            />
            <Button
              type='submit'
              size='icon'
              aria-label='Search'
              className='absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-primary text-white hover:bg-primary/90'
            >
              <Search className='h-4 w-4' />
            </Button>
          </form>
          {showDropdown && (
            <ul
              id='site-search-suggestions'
              role='listbox'
              className='absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl bg-white p-3 shadow-lg shadow-black/5'
            >
              <li className='mb-1 px-2 text-xs font-medium text-slate-400'>Suggestions</li>
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion + ':' + index}
                  role='option'
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    handleSuggestionClick(suggestion)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 ' +
                    (index === activeIndex ? 'bg-primary/5' : 'hover:bg-primary/5')
                  }
                >
                  <Search className='h-4 w-4 shrink-0 text-slate-400' aria-hidden='true' />
                  <span>{highlightMatch(suggestion, inputValue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button asChild variant='outline' size='icon' aria-label='Cart' className='shrink-0'>
          <Link to='/cart'>
            <ShoppingCart className='h-4 w-4' />
          </Link>
        </Button>
      </div>
    </header>
  )
}
`;
}
function siteFooterSource() {
  return `import { useStore } from '@/app/store-provider'\nexport function SiteFooter() { const { storeDetail } = useStore(); return <footer className='bg-deep text-deep-foreground'><div className='mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4'><div><h3 className='text-xl font-semibold'>{storeDetail?.name}</h3><p className='mt-3 text-sm text-deep-foreground/70'>{storeDetail?.description}</p></div>{['Shop','Support','Company'].map((title) => <div key={title}><h4 className='font-semibold'>{title}</h4><ul className='mt-3 space-y-2 text-sm text-deep-foreground/70'><li>Products</li><li>Orders</li><li>Contact</li></ul></div>)}<div><h4 className='font-semibold'>Connect</h4><p className='mt-3 text-sm text-deep-foreground/70'>Follow new drops and member offers.</p></div></div></footer> }\n`;
}
function heroSectionSource() {
  return `import { Link } from '@tanstack/react-router'\nimport { Button } from '@/components/ui/button'\nimport { websiteConfig } from '@/lib/website-config'\nexport function HeroSection() { return <section className='mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24'><div className='flex flex-col justify-center gap-6'><p className='text-sm font-semibold uppercase tracking-[0.25em] text-primary'>{websiteConfig.brand.tone}</p><h1 className='text-5xl font-bold tracking-tight md:text-7xl'>{websiteConfig.content.heroTitle}</h1><p className='max-w-xl text-lg text-muted-foreground'>{websiteConfig.content.heroSubtitle}</p><div className='flex gap-3'><Button asChild size='lg'><Link to='/products'>{websiteConfig.content.primaryCta ?? 'Shop now'}</Link></Button><Button asChild variant='outline' size='lg'><Link to='/checkout'>Checkout demo</Link></Button></div></div><div className='min-h-[420px] rounded-[2rem] bg-gradient-to-br from-[#00754A] via-[#CBA258] to-[#1E3932] p-8 shadow-2xl'><div className='h-full rounded-[1.5rem] border border-white/20 bg-white/20 backdrop-blur' /></div></section> }\n`;
}
function productCardSource() {
  return `import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { formatMoney, resolveProductPrice } from '@/lib/format-money'
import { useStore } from '@/app/store-provider'
import type { Product } from '@/services/store/use-products-list'

export function ProductCard({ product }: { product: Product }) {
  const currency = useStore().storeDetail?.setting?.currency ?? 'AUD'
  const heroImage = product.image ?? product.images?.[0]
  const sanitizedDescriptions = useMemo(
    () => DOMPurify.sanitize(product.descriptions ?? ''),
    [product.descriptions],
  )
  return (
    <Card className='overflow-hidden'>
      {heroImage ? (
        <img src={heroImage} alt={product.name} className='h-56 w-full object-cover' />
      ) : (
        <div className='h-56 bg-gradient-to-br from-secondary to-primary/20' />
      )}
      <CardContent className='space-y-3 p-5'>
        <div className='flex items-center justify-between gap-3'>
          <Link
            to='/products/$productId'
            params={{ productId: product.id }}
            className='font-semibold hover:underline'
          >
            <h3>{product.name}</h3>
          </Link>
          <Button variant='ghost' size='icon'><Heart className='h-4 w-4' /></Button>
        </div>
        <div
          className='line-clamp-2 text-sm text-muted-foreground'
          dangerouslySetInnerHTML={{ __html: sanitizedDescriptions }}
        />
        <div className='flex items-center gap-2'>
          <span className='font-semibold'>{formatMoney(resolveProductPrice(product), { currency })}</span>
          {product.compareAtPrice && <Badge variant='sale'>Sale</Badge>}
        </div>
      </CardContent>
      <CardFooter>
        <Button className='w-full' onClick={() => toast.info('Cart coming soon')}>Add to cart</Button>
      </CardFooter>
    </Card>
  )
}
`;
}
function productGridSource() {
  return `import { useEffect, useRef } from 'react'
import { ProductCard } from '@/components/store/product-card'
import { Button } from '@/components/ui/button'
import { useStoreDetail } from '@/services/store/use-store-detail'
import { useProductsList } from '@/services/store/use-products-list'

export function ProductGrid() {
  const storeId = useStoreDetail().data?.id
  const {
    products,
    total,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useProductsList({ storeId })
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <section className='mx-auto max-w-7xl px-4 py-14'>
      <div className='mb-8 flex items-end justify-between'>
        <div>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-primary'>Featured</p>
          <h2 className='text-3xl font-bold'>Shop customer favorites</h2>
        </div>
        <p className='text-sm text-muted-foreground'>{total} products</p>
      </div>
      {isLoading ? (
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className='h-72 animate-pulse rounded-lg border bg-muted/40' />
          ))}
        </div>
      ) : isError ? (
        <div className='rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-destructive'>Products unavailable</p>
          <h3 className='mt-2 text-2xl font-semibold'>We could not load products.</h3>
          <Button type='button' className='mt-4' onClick={() => { void refetch() }}>Retry</Button>
        </div>
      ) : (
        <>
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
          {hasNextPage && (
            <div ref={loadMoreRef} className='py-8 text-center text-sm text-muted-foreground'>
              {isFetchingNextPage ? 'Loading more...' : ''}
            </div>
          )}
        </>
      )}
    </section>
  )
}
`;
}
function trustSignalsSource() {
  return `import { Headphones, RotateCcw, Shield, Truck } from 'lucide-react'\nconst items = [{ icon: Truck, label: 'Fast shipping' }, { icon: RotateCcw, label: 'Easy returns' }, { icon: Shield, label: 'Secure checkout' }, { icon: Headphones, label: 'Human support' }]\nexport function TrustSignals() { return <section className='mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4'>{items.map(({ icon: Icon, label }) => <div key={label} className='rounded-lg border bg-card p-5'><Icon className='mb-3 h-6 w-6 text-primary' /><p className='font-medium'>{label}</p></div>)}</section> }\n`;
}
function categorySectionSource() {
  return `import { useStoreDetail } from '@/services/store/use-store-detail'
import { useCategoriesList } from '@/services/store/use-categories-list'

export function CategorySection() {
  const storeId = useStoreDetail().data?.id
  const { data } = useCategoriesList(storeId)
  const categories = data?.data ?? []
  return (
    <section className='mx-auto max-w-7xl px-4 py-10'>
      <h2 className='text-2xl font-bold'>Browse categories</h2>
      <div className='mt-5 flex flex-wrap gap-3'>
        {categories.map((category) => (
          <span key={category.id} className='rounded-full border bg-card px-4 py-2 text-sm'>{category.name}</span>
        ))}
      </div>
    </section>
  )
}
`;
}
function cartDrawerSource() {
  return `import { ShoppingCart } from 'lucide-react'\nexport function CartDrawer() { return <div className='inline-flex items-center gap-2'><ShoppingCart className='h-4 w-4' /></div> }\n`;
}
function cartItemSource() {
  return `import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney, resolveProductPrice } from '@/lib/format-money'
import { useStore } from '@/app/store-provider'
import type { Product } from '@/services/store/use-products-list'

export function CartItem({ product, quantity }: { product: Product; quantity: number }) {
  const currency = useStore().storeDetail?.setting?.currency ?? 'AUD'
  const unitPriceCents = resolveProductPrice(product) ?? 0
  const thumbnail = product.image ?? product.images?.[0]
  return (
    <div className='flex items-center gap-4 rounded-lg border bg-card p-4'>
      {thumbnail ? (
        <img src={thumbnail} alt={product.name} className='h-20 w-20 rounded-md object-cover' />
      ) : (
        <div className='h-20 w-20 rounded-md bg-secondary' />
      )}
      <div className='flex-1'>
        <h3 className='font-semibold'>{product.name}</h3>
        <p className='text-sm text-muted-foreground'>{formatMoney(unitPriceCents, { currency })}</p>
      </div>
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='icon' disabled><Minus className='h-4 w-4' /></Button>
        <span className='w-8 text-center'>{quantity}</span>
        <Button variant='outline' size='icon' disabled><Plus className='h-4 w-4' /></Button>
        <Button variant='ghost' size='icon' disabled><Trash2 className='h-4 w-4' /></Button>
      </div>
      <strong>{formatMoney(unitPriceCents * quantity, { currency })}</strong>
    </div>
  )
}
`;
}
function orderCardSource() {
  return `import { Link } from '@tanstack/react-router'\nimport { Badge } from '@/components/ui/badge'\nimport { Button } from '@/components/ui/button'\nimport { Card, CardContent } from '@/components/ui/card'\nimport { formatMoney } from '@/lib/format-money'\ntype OrderSummary = { id: string; date: string; status: string; total: number }\nexport function OrderCard({ order }: { order: OrderSummary }) { return <Card><CardContent className='flex flex-wrap items-center justify-between gap-4 p-5'><div><p className='font-semibold'>Order {order.id}</p><p className='text-sm text-muted-foreground'>{new Date(order.date).toLocaleDateString()}</p></div><Badge>{order.status}</Badge><strong>{formatMoney(order.total)}</strong><Button asChild variant='outline'><Link to='/orders/$orderId' params={{ orderId: order.id }}>View details</Link></Button></CardContent></Card> }\n`;
}
function homeRouteSource() {
  return `import { createFileRoute } from '@tanstack/react-router'\nimport { HeroSection } from '@/components/store/hero-section'\nimport { ProductGrid } from '@/components/store/product-grid'\nimport { TrustSignals } from '@/components/store/trust-signals'\nimport { CategorySection } from '@/components/store/category-section'\nexport const Route = createFileRoute('/')({ component: HomePage })\nfunction HomePage() { return <main><HeroSection /><CategorySection /><ProductGrid /><TrustSignals /><section className='bg-[#1E3932] px-4 py-16 text-center text-white'><h2 className='text-3xl font-bold'>Ready for your next favorite?</h2><p className='mt-3 text-white/70'>Checkout is mocked so you can test the full flow immediately.</p></section></main> }\n`;
}
function productsLayoutRouteSource() {
  return `import { Outlet, createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/products')({ component: ProductsLayout })\nfunction ProductsLayout() { return <Outlet /> }\n`;
}
function productsIndexRouteSource() {
  return `import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { ProductCard } from '@/components/store/product-card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStoreDetail } from '@/services/store/use-store-detail'
import { useProductsList } from '@/services/store/use-products-list'
import { useCategoriesList } from '@/services/store/use-categories-list'

type ProductsSearch = { q: string }

export const Route = createFileRoute('/products/')({
  component: ProductsPage,
  validateSearch: (search: Record<string, unknown>): ProductsSearch => ({
    q: typeof search.q === 'string' ? search.q.trim() : '',
  }),
})

function ProductsPage() {
  const { q } = Route.useSearch()
  const storeId = useStoreDetail().data?.id
  const productsQuery = useProductsList({ storeId, query: q })
  const categoriesQuery = useCategoriesList(storeId)
  const products = productsQuery.products
  const total = productsQuery.total
  const categories = categoriesQuery.data?.data ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !productsQuery.hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !productsQuery.isFetchingNextPage) {
          void productsQuery.fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [productsQuery.hasNextPage, productsQuery.isFetchingNextPage, productsQuery.fetchNextPage])

  const showEmptyState =
    products.length === 0 && !productsQuery.isLoading && !productsQuery.isError

  return (
    <main className='mx-auto max-w-7xl px-4 py-12'>
      <div className='mb-8 flex flex-wrap items-center justify-between gap-4'>
        <div>
          <h1 className='text-4xl font-bold'>Products</h1>
          {q ? (
            <p className='text-sm text-muted-foreground'>
              Results for <span className='font-medium text-foreground'>"{q}"</span> · {total} products
            </p>
          ) : (
            <p className='text-muted-foreground'>{total} curated products</p>
          )}
        </div>
        <Select defaultValue='featured'>
          <SelectTrigger className='w-44'><SelectValue placeholder='Sort' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='featured'>Featured</SelectItem>
            <SelectItem value='price-low'>Price low</SelectItem>
            <SelectItem value='price-high'>Price high</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {categories.length > 0 && (
        <div className='mb-6 flex flex-wrap gap-2'>
          {categories.map((category) => (
            <Button key={category.id} variant='outline' size='sm'>{category.name}</Button>
          ))}
        </div>
      )}
      {productsQuery.isLoading ? (
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className='h-72 animate-pulse rounded-lg border bg-muted/40' />
          ))}
        </div>
      ) : productsQuery.isError ? (
        <div className='rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-destructive'>Products unavailable</p>
          <h3 className='mt-2 text-2xl font-semibold'>We could not load products.</h3>
          <Button type='button' className='mt-4' onClick={() => { void productsQuery.refetch() }}>Retry</Button>
        </div>
      ) : showEmptyState ? (
        <div className='rounded-3xl border bg-muted/20 p-10 text-center'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'>No matches</p>
          <h3 className='mt-2 text-2xl font-semibold'>
            {q ? <>No products match "{q}"</> : 'No products yet'}
          </h3>
          <p className='mt-2 text-sm text-muted-foreground'>Try a different search term.</p>
        </div>
      ) : (
        <>
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
          {productsQuery.hasNextPage && (
            <div ref={loadMoreRef} className='py-8 text-center text-sm text-muted-foreground'>
              {productsQuery.isFetchingNextPage ? 'Loading more...' : ''}
            </div>
          )}
        </>
      )}
    </main>
  )
}
`;
}
function productDetailRouteSource() {
  return `import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { useProductDetail } from '@/services/store/use-product-detail'
import { formatMoney, resolveProductPrice } from '@/lib/format-money'
import { useStore } from '@/app/store-provider'
import type { ProductModel } from '@/services/store/use-products-list'

const DESCRIPTION_THRESHOLD = 240

export const Route = createFileRoute('/products/$productId')({ component: ProductDetailPage })

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const { data: product, isLoading, isError, refetch } = useProductDetail(productId)
  const { storeDetail } = useStore()
  const currency = storeDetail?.setting?.currency ?? 'AUD'

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedModel, setSelectedModel] = useState<ProductModel | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const models = useMemo(() => (product?.models ?? []) as ProductModel[], [product])
  const initialModel = useMemo(() => product?.defaultModel ?? models[0], [product, models])
  const activeModel = selectedModel ?? initialModel
  const selectedPrice = activeModel?.price ?? resolveProductPrice(product) ?? 0
  const totalPrice = selectedPrice * quantity

  const images = product?.images ?? (product?.image ? [product.image] : [])
  const mainImage = images[selectedImageIndex] ?? images[0] ?? product?.image
  const showThumbnails = images.length > 1

  const descriptions = product?.descriptions ?? ''
  const isLongDescription = descriptions.length > DESCRIPTION_THRESHOLD
  const sanitizedDescriptions = useMemo(
    () => DOMPurify.sanitize(descriptions),
    [descriptions],
  )

  if (isLoading) {
    return (
      <main className='mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-2'>
        <div className='min-h-[520px] animate-pulse rounded-[2rem] bg-muted/40' />
        <div className='space-y-4'>
          <div className='h-6 w-32 animate-pulse rounded bg-muted/40' />
          <div className='h-12 w-3/4 animate-pulse rounded bg-muted/40' />
          <div className='h-24 w-full animate-pulse rounded bg-muted/40' />
        </div>
      </main>
    )
  }
  if (isError || !product) {
    return (
      <main className='mx-auto max-w-3xl px-4 py-16'>
        <div className='rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-destructive'>Product unavailable</p>
          <h3 className='mt-2 text-2xl font-semibold'>We could not load this product.</h3>
          <Button type='button' className='mt-4' onClick={() => { void refetch() }}>Retry</Button>
        </div>
      </main>
    )
  }

  const handleConfirm = () => {
    toast.info('Cart coming soon')
    setIsSheetOpen(false)
  }

  return (
    <main className='mx-auto max-w-7xl px-4 py-8 pb-28 md:pb-12'>
      <Link to='/products' className='text-sm text-muted-foreground'>← Products</Link>
      <div className='mt-6 grid gap-10 lg:grid-cols-2'>
        <div className='space-y-4'>
          {mainImage ? (
            <img
              src={mainImage}
              alt={product.name}
              className='min-h-[520px] w-full rounded-[2rem] object-cover'
            />
          ) : (
            <div className='min-h-[520px] rounded-[2rem] bg-gradient-to-br from-secondary to-primary/30' />
          )}
          {showThumbnails && (
            <div className='flex gap-3 overflow-x-auto py-2'>
              {images.map((src, index) => (
                <button
                  key={src + index}
                  type='button'
                  onClick={() => setSelectedImageIndex(index)}
                  className='shrink-0 rounded-full focus:outline-none'
                  aria-label={\`Show image \${index + 1}\`}
                >
                  <img
                    src={src}
                    alt={\`\${product.name} thumbnail \${index + 1}\`}
                    className={
                      'h-20 w-20 rounded-full object-cover ring-2 transition ' +
                      (index === selectedImageIndex ? 'ring-primary' : 'ring-transparent')
                    }
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='space-y-6'>
          {product.category?.name && (
            <p className='text-xs font-semibold uppercase tracking-[0.2em] text-primary'>
              {product.category.name}
            </p>
          )}
          <h1 className='text-4xl font-bold leading-tight md:text-5xl'>{product.name}</h1>
          <div className='border-t pt-4'>
            <p className='text-3xl font-semibold'>
              {formatMoney(selectedPrice, { currency })}
            </p>
          </div>

          {models.length > 0 && (
            <div className='hidden md:block'>
              <p className='mb-2 text-sm font-medium'>Select option</p>
              <div className='flex flex-wrap gap-2'>
                {models.map((model) => {
                  const isActive = (model.id ?? '') === (activeModel?.id ?? '')
                  return (
                    <button
                      key={(model.id ?? '') + (model.name ?? '')}
                      type='button'
                      onClick={() => setSelectedModel(model)}
                      className={
                        'rounded-full px-4 py-2 text-sm transition ' +
                        (isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground hover:bg-muted/80')
                      }
                    >
                      {(model.name as string) ?? model.id}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {descriptions && (
            <div className='space-y-2'>
              <div
                className={
                  'prose prose-sm max-w-none text-base text-muted-foreground ' +
                  (isLongDescription && !isExpanded ? 'line-clamp-4' : '')
                }
                dangerouslySetInnerHTML={{ __html: sanitizedDescriptions }}
              />
              {isLongDescription && (
                <button
                  type='button'
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className='text-sm font-semibold text-primary hover:underline'
                >
                  {isExpanded ? 'Read less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          <div className='hidden space-y-4 rounded-2xl border bg-card p-5 md:block'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold'>Quantity</p>
                <p className='text-xs text-muted-foreground'>Current selected option quantity</p>
              </div>
              <div className='flex items-center gap-3'>
                <Button
                  variant='outline'
                  size='icon'
                  type='button'
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label='Decrease quantity'
                >
                  −
                </Button>
                <span className='w-6 text-center text-base font-medium'>{quantity}</span>
                <Button
                  variant='outline'
                  size='icon'
                  type='button'
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label='Increase quantity'
                >
                  +
                </Button>
              </div>
            </div>
            <div className='flex items-center justify-between border-t pt-4'>
              <p className='text-sm font-semibold'>Total</p>
              <p className='text-xl font-semibold'>{formatMoney(totalPrice, { currency })}</p>
            </div>
            <Button
              size='lg'
              type='button'
              className='w-full'
              onClick={() => toast.info('Cart coming soon')}
            >
              Add to cart
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button
            size='lg'
            type='button'
            className='fixed inset-x-4 bottom-4 z-40 md:hidden'
          >
            Add to Cart
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{product.name}</SheetTitle>
            <p className='text-2xl font-semibold text-primary'>
              {formatMoney(selectedPrice, { currency })}
            </p>
          </SheetHeader>
          {models.length > 0 ? (
            <div className='mt-4 max-h-[40vh] space-y-2 overflow-y-auto'>
              {models.map((model) => {
                const isActive = (model.id ?? '') === (activeModel?.id ?? '')
                return (
                  <button
                    key={(model.id ?? '') + (model.name ?? '')}
                    type='button'
                    onClick={() => setSelectedModel(model)}
                    className={
                      'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ' +
                      (isActive ? 'border-primary bg-primary/10' : 'border-transparent bg-muted')
                    }
                  >
                    <span className='text-sm font-medium'>
                      {(model.name as string) ?? model.id}
                    </span>
                    <span className='text-sm font-semibold'>
                      {formatMoney(model.price ?? 0, { currency })}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className='mt-4 flex items-center justify-between'>
            <p className='text-sm font-semibold'>Quantity</p>
            <div className='flex items-center gap-3'>
              <Button
                variant='outline'
                size='icon'
                type='button'
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label='Decrease quantity'
              >
                −
              </Button>
              <span className='w-6 text-center text-base font-medium'>{quantity}</span>
              <Button
                variant='outline'
                size='icon'
                type='button'
                onClick={() => setQuantity((q) => q + 1)}
                aria-label='Increase quantity'
              >
                +
              </Button>
            </div>
          </div>
          <div className='mt-4 flex items-center justify-between border-t pt-4'>
            <p className='text-sm font-semibold'>Total</p>
            <p className='text-lg font-semibold'>{formatMoney(totalPrice, { currency })}</p>
          </div>
          <div className='mt-4 flex gap-2'>
            <SheetClose asChild>
              <Button variant='outline' type='button' className='flex-1'>
                Cancel
              </Button>
            </SheetClose>
            <Button type='button' className='flex-1' onClick={handleConfirm}>
              Add to cart
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  )
}
`;
}
function cartRouteSource() {
  return `import { Link, createFileRoute } from '@tanstack/react-router'\nimport { ShoppingCart } from 'lucide-react'\nimport { Button } from '@/components/ui/button'\nexport const Route = createFileRoute('/cart')({ component: CartPage })\nfunction CartPage() { return <main className='mx-auto max-w-7xl px-4 py-12'><h1 className='mb-8 text-4xl font-bold'>Cart</h1><div className='rounded-lg border bg-card p-12 text-center'><ShoppingCart className='mx-auto mb-4 h-10 w-10 text-muted-foreground' /><h2 className='text-2xl font-semibold'>Cart coming soon</h2><p className='mt-2 text-sm text-muted-foreground'>Cart is not yet wired up.</p><Button asChild className='mt-6'><Link to='/products'>Continue shopping</Link></Button></div></main> }\n`;
}
function checkoutRouteSource() {
  return `import { createFileRoute } from '@tanstack/react-router'\nimport { useForm } from 'react-hook-form'\nimport { z } from 'zod'\nimport { toast } from 'sonner'\nimport { Button } from '@/components/ui/button'\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'\nimport { Input } from '@/components/ui/input'\nimport { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'\nconst checkoutSchema = z.object({ customerName: z.string().min(2), email: z.string().email(), address: z.string().min(6), shippingMethod: z.enum(['standard', 'express']) })\ntype CheckoutValues = z.infer<typeof checkoutSchema>\nexport const Route = createFileRoute('/checkout')({ component: CheckoutPage })\nfunction CheckoutPage() { const { register, handleSubmit, setValue, formState: { errors } } = useForm<CheckoutValues>({ defaultValues: { shippingMethod: 'standard' } }); return <main className='mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px]'><form className='space-y-5' onSubmit={handleSubmit((values) => { const parsed = checkoutSchema.safeParse(values); if (!parsed.success) return; toast.success('Order placed (demo)', { description: 'Cart is not yet wired up.' }) })}><h1 className='text-4xl font-bold'>Checkout</h1><Input placeholder='Full name' {...register('customerName')} />{errors.customerName && <p className='text-sm text-destructive'>Name is required</p>}<Input placeholder='Email' {...register('email')} /><Input placeholder='Shipping address' {...register('address')} /><RadioGroup defaultValue='standard' onValueChange={(value) => setValue('shippingMethod', value as CheckoutValues['shippingMethod'])}><label className='flex items-center gap-2'><RadioGroupItem value='standard' /> Standard shipping</label><label className='flex items-center gap-2'><RadioGroupItem value='express' /> Express shipping</label></RadioGroup><Button type='submit'>Place order</Button></form><Card><CardHeader><CardTitle>Order summary</CardTitle></CardHeader><CardContent className='space-y-3'><p className='text-sm text-muted-foreground'>Order summary will appear here once the cart is connected.</p></CardContent></Card></main> }\n`;
}
function ordersIndexRouteSource() {
  return `import { Link, createFileRoute } from '@tanstack/react-router'\nimport { Button } from '@/components/ui/button'\nexport const Route = createFileRoute('/orders/')({ component: OrdersPage })\nfunction OrdersPage() { return <main className='mx-auto max-w-7xl px-4 py-12'><h1 className='mb-8 text-4xl font-bold'>Orders</h1><div className='rounded-lg border bg-card p-12 text-center'><h2 className='text-2xl font-semibold'>No orders yet</h2><Button asChild className='mt-6'><Link to='/products'>Shop now</Link></Button></div></main> }\n`;
}
function orderDetailRouteSource() {
  return `import { Link, createFileRoute } from '@tanstack/react-router'\nimport { Button } from '@/components/ui/button'\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'\nexport const Route = createFileRoute('/orders/$orderId')({ component: OrderDetailPage })\nfunction OrderDetailPage() { const { orderId } = Route.useParams(); return <main className='mx-auto max-w-3xl px-4 py-12'><Link to='/orders' className='text-sm text-muted-foreground'>← Orders</Link><h1 className='mt-4 text-4xl font-bold'>Order {orderId}</h1><Card className='mt-8'><CardHeader><CardTitle>Order details unavailable</CardTitle></CardHeader><CardContent className='space-y-2'><p className='text-sm text-muted-foreground'>Cart and order persistence are not yet wired up.</p><Button asChild className='mt-4'><Link to='/orders'>Back to orders</Link></Button></CardContent></Card></main> }\n`;
}
