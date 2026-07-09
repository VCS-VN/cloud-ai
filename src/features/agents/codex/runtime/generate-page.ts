// Shared parsing + mapping for the `/generate-page <slug> <description>` chat
// command. The dispatcher parses the prefix to route the run to the
// generate_page driver; the driver maps the slug to a route file + spec.

// The 7 known storefront pages. `slug` is what the user types after
// /generate-page; `route` is the workspace-relative file the run authors;
// `spec` is the init page-spec (under templates/codex-builder/init/pages/)
// embedded verbatim into the prompt so a generate matches init-grade quality.
export const KNOWN_PAGES = [
  { slug: "home", route: "src/routes/index.tsx", spec: "pages/home.md", label: "Home" },
  { slug: "products", route: "src/routes/products/index.tsx", spec: "pages/products.md", label: "Products" },
  { slug: "product-detail", route: "src/routes/products/$productId.tsx", spec: "pages/product-detail.md", label: "Product detail" },
  { slug: "cart", route: "src/routes/cart.tsx", spec: "pages/cart.md", label: "Cart" },
  { slug: "checkout", route: "src/routes/checkout.tsx", spec: "pages/checkout.md", label: "Checkout" },
  { slug: "orders", route: "src/routes/orders.tsx", spec: "pages/orders.md", label: "Orders" },
  { slug: "order-detail", route: "src/routes/orders/$orderId.tsx", spec: "pages/order-detail.md", label: "Order detail" },
] as const;

export type KnownPageSlug = (typeof KNOWN_PAGES)[number]["slug"];

export const GENERATE_PAGE_COMMAND = "/modify-page";

export type GeneratePageTarget = {
  slug: string;
  isKnownPage: boolean;
  route?: string;
  spec?: string;
};

export type ParsedGeneratePageCommand = {
  target: GeneratePageTarget;
  // The prompt with the `/generate-page <slug>` prefix stripped — the user's
  // free-text description of what the page should contain (may be empty).
  restPrompt: string;
};

const GENERATE_PAGE_RE = /^\/modify-page\s+(\S+)\s*([\s\S]*)$/;

export function findKnownPage(slug: string) {
  return KNOWN_PAGES.find((page) => page.slug === slug);
}

// A normal chat prompt (small_update / new_route) never carries an explicit
// /modify-page slug, so it does not load a page spec — the agent only sees the
// generic route-ownership map, not the per-page authoring contract (search
// param, infinite scroll, required sections, hooks). This matcher recovers the
// intended page(s) from the files the run will touch + the prompt text, so
// those drivers can embed the SAME `pages/*.md` spec that /modify-page uses.
//
// Signals (union, deduped):
// - a known page's route file appears in the run's scoped/relevant files, or
// - the prompt names the route path or the slug as a whole word.
// Order follows KNOWN_PAGES. Note product-detail's route is a strict superset
// of the products route prefix, so we match on the FULL route string to avoid
// mislabeling `$productId.tsx` as the `products` list page.
export function matchKnownPagesForEdit(input: {
  relevantFiles: readonly string[];
  prompt: string;
}): (typeof KNOWN_PAGES)[number][] {
  const files = new Set(input.relevantFiles.map((f) => f.trim()));
  const prompt = input.prompt.toLowerCase();
  const matched: (typeof KNOWN_PAGES)[number][] = [];
  for (const page of KNOWN_PAGES) {
    const byFile = files.has(page.route);
    const byRouteMention = prompt.includes(page.route.toLowerCase());
    const bySlug = new RegExp(`\\b${page.slug.replace(/-/g, "[\\s-]?")}\\b`, "i").test(
      input.prompt,
    );
    if (byFile || byRouteMention || bySlug) matched.push(page);
  }
  return matched;
}

// Parse a chat prompt. Returns null when the prompt is not a /generate-page
// command, so the caller falls through to the normal classifier.
export function parseGeneratePageCommand(prompt: string): ParsedGeneratePageCommand | null {
  const match = prompt.trim().match(GENERATE_PAGE_RE);
  if (!match) return null;

  const slug = match[1].toLowerCase();
  const restPrompt = match[2].trim();
  const known = findKnownPage(slug);

  return {
    target: known
      ? { slug, isKnownPage: true, route: known.route, spec: known.spec }
      : { slug, isKnownPage: false },
    restPrompt,
  };
}
