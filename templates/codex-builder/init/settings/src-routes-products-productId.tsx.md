---
target: src/routes/products/$productId.tsx
---
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { useCart } from "@/app/cart-provider";
import { Button } from "@/components/ui/button";
import { formatMoney, resolveProductPrice } from "@/lib/format-money";
import { useProductDetail } from "@/services/store/use-product-detail";

export const Route = createFileRoute("/products/$productId")({
  component: ProductDetailPage,
});

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { data: product, isLoading } = useProductDetail(productId);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const model = useMemo(() => product?.defaultModel ?? product?.models?.[0], [product]);

  // product.descriptions is an HTML string — sanitize with DOMPurify before
  // injecting into the DOM to prevent XSS. The typeof window guard is required
  // because DOMPurify accesses window and will crash during SSR (Node.js).
  const sanitizedDescriptions = useMemo(() => {
    const html = product?.descriptions ?? "";
    return typeof window !== "undefined" ? DOMPurify.sanitize(html) : escapeHtml(html);
  }, [product?.descriptions]);

  if (isLoading) {
    return <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-12">Loading product...</main>;
  }
  if (!product || !model) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Product not found</h1>
        <Link to="/products" className="mt-4 inline-flex text-sm font-medium text-primary">
          Back to products
        </Link>
      </main>
    );
  }

  const image = product.image ?? product.images?.[0];

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-7xl gap-10 px-4 py-10 lg:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border bg-muted">
        {image ? <img src={image} alt={product.name} className="aspect-square h-full w-full object-cover" /> : null}
      </div>
      <section className="space-y-6">
        <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground">
          Back to products
        </Link>
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {product.category?.name ?? "Product"}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-2xl font-semibold">{formatMoney(resolveProductPrice(product))}</p>
        </div>
        {sanitizedDescriptions ? (
          <div
            className="prose prose-sm max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizedDescriptions }}
          />
        ) : null}
        <Button
          onClick={() => {
            addItem({ product, model, quantity: 1 });
            setAdded(true);
          }}
        >
          {added ? "Added to cart" : "Add to cart"}
        </Button>
      </section>
    </main>
  );
}
