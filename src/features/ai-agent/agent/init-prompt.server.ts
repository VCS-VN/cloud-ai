import type { WebsiteSpec } from "../project/project-state.schema";
import type { ProjectDesignRuleContext } from "../code-tools/services/design-file-service.server";

export function buildRetailInitPrompt(input: {
  userPrompt: string;
  websiteSpec: WebsiteSpec;
  designRules: ProjectDesignRuleContext;
}): string {
  const { websiteSpec: spec } = input;
  const productList = spec.products
    .map(
      (p) =>
        "- " +
        p.name +
        (p.price ? " ($" + p.price + ")" : "") +
        (p.category ? " [" + p.category + "]" : ""),
    )
    .join("\n");

  return [
    "CREATE all files listed below using project_create_file tool.",
    "Do NOT read files first. Do NOT inspect. Just CREATE the files.",
    "",
    "STORE: " + spec.store.name + " (" + spec.store.type + ")",
    "PRODUCTS:",
    productList,
    "",
    "DESIGN: Warm canvas #F2F0EB, Accent #00754A CTAs, Deep #1E3932 footer, Gold #CBA258 badges, 12px cards, 50px pills",
    "",
    "IMPORTS AVAILABLE:",
    '- { products } from "@/data/products"',
    '- { categories } from "@/data/categories"',
    '- { websiteConfig } from "@/lib/website-config"',
    '- { cartItemsAtom } from "@/lib/cart-store"',
    '- { formatMoney } from "@/lib/format-money"',
    '- { cn } from "@/lib/utils"',
    '- { StoreProvider, useStore } from "@/app/store-provider"',
    "",
    "ROUTING (TanStack Start):",
    '- createFileRoute("/path")({ component: Fn }) for pages',
    '- createRootRoute({ component: Fn }) for __root.tsx',
    '- Trailing slash for index: createFileRoute("/products/")',
    '- Dynamic: createFileRoute("/products/$productId")',
    '- Route.useParams() for params',
    '- NEVER edit routeTree.gen.ts',
    "",
    "CREATE THESE FILES:",
    "",
    "src/components/ui/button.tsx - shadcn Button with cva, variants: default/destructive/outline/secondary/ghost/link, sizes: default/sm/lg/icon, rounded-full, active:scale-95, use cn()",
    "",
    "src/components/ui/card.tsx - shadcn Card/CardHeader/CardContent/CardFooter/CardTitle/CardDescription, rounded-lg border shadow-sm",
    "",
    "src/app/store-provider.tsx - StoreProvider wrapper for all pages; exposes shared cart/order state, add/remove/update/clear cart, create/get mock orders, cart count/subtotal/shipping/total",
    "",
    "src/components/ui/input.tsx - shadcn Input, h-10 rounded-md border px-3 py-2, focus-visible:ring-2",
    "",
    "src/components/ui/badge.tsx - shadcn Badge with cva, variants: default/secondary/destructive/outline/sale(amber-600), rounded-full",
    "",
    "src/components/ui/separator.tsx - shadcn Separator using @radix-ui/react-separator",
    "",
    "src/components/ui/label.tsx - shadcn Label using @radix-ui/react-label",
    "",
    "src/components/ui/select.tsx - shadcn Select using @radix-ui/react-select with SelectTrigger/SelectContent/SelectItem/SelectValue",
    "",
    "src/components/ui/radio-group.tsx - shadcn RadioGroup using @radix-ui/react-radio-group with RadioGroupItem",
    "",
    "src/components/ui/dialog.tsx - shadcn Dialog modal using @radix-ui/react-dialog with DialogTrigger/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogClose",
    "",
    "src/components/ui/sonner.tsx - Toaster wrapper using sonner; checkout uses toast.success after createOrder",
    "",
    "src/components/layout/site-header.tsx - Retail nav: brand name, links (Home/Products/Orders), ShoppingCart icon with Badge count, mobile Sheet menu, sticky top-0 border-b",
    "",
    "src/components/layout/site-footer.tsx - Deep Brand #1E3932 bg, white text, 4 cols (Shop/Support/Company/Connect), responsive grid",
    "",
    "src/components/store/hero-section.tsx - Headline from websiteConfig.content.heroTitle, subtitle, CTA Button to /products, gradient visual placeholder, split layout",
    "",
    "src/components/store/product-card.tsx - Card with gradient visual, name, formatMoney(price), sale Badge, Add to cart Button, Heart wishlist, Link to /products/$id",
    "",
    "src/components/store/product-grid.tsx - Title, grid-cols-1 sm:2 lg:3 xl:4 gap-6, map products to ProductCard",
    "",
    "src/components/store/trust-signals.tsx - Truck/RotateCcw/Shield/Headphones icons, 4 items grid",
    "",
    "src/components/store/feature-band.tsx - #1E3932 bg, headline, 2 Buttons (white filled + white outline)",
    "",
    "src/components/store/newsletter-section.tsx - Heading, Input + Button form, useState email",
    "",
    "src/components/store/cart-item.tsx - Thumbnail, name, price, quantity +/- Buttons, remove Button, subtotal",
    "",
    "src/components/store/order-card.tsx - Card with order#, date, status Badge, total, Link to detail",
    "",
    "src/routes/__root.tsx - createRootRoute, html/head(HeadContent)/body(Providers/StoreProvider/SiteHeader/Outlet/SiteFooter/Toaster/Scripts), import app.css",
    "",
    "src/routes/index.tsx - createFileRoute('/'), compose HeroSection/ProductGrid/TrustSignals/FeatureBand/NewsletterSection",
    "",
    "src/routes/products/index.tsx - createFileRoute('/products/'), title, category filter Buttons, sort Select, product grid, product count",
    "",
    "src/routes/products/$productId.tsx - createFileRoute('/products/$productId'), Route.useParams(), breadcrumb, split layout, name/price/badge/description, quantity +/-, Add to cart Button",
    "",
    "src/routes/cart.tsx - createFileRoute('/cart'), empty state with ShoppingCart icon + Continue Shopping Button, cart items list, summary Card with subtotal/shipping/total, Checkout Button",
    "",
    "src/routes/checkout.tsx - createFileRoute('/checkout'), 2 cols desktop, shipping form (Input+Label), mock payment, order summary Card, Place Order Button, react-hook-form+zod",
    "",
    "src/routes/orders/index.tsx - createFileRoute('/orders/'), title, OrderCard list, empty state with Shop Now Button",
    "",
    "src/routes/orders/$orderId.tsx - createFileRoute('/orders/$orderId'), Route.useParams(), breadcrumb, order header, items list, summary Card, back link",
    "",
    "NOW CREATE ALL FILES using project_create_file. START IMMEDIATELY.",
  ].join("\n");
}
