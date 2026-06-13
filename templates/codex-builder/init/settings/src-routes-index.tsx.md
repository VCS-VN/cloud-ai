---
target: src/routes/index.tsx
---
import { Link, createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/app/store-provider";
import { useProductsList } from "@/services/store/use-products-list";
import { Button } from "@/components/ui/button";
import { formatMoney, resolveProductPrice } from "@/lib/format-money";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { storeDetail } = useStore();
  const { products, isLoading } = useProductsList({ storeId: storeDetail?.id });

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-7xl flex-col gap-12 px-4 py-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {storeDetail?.name ?? "Storefront"}
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Build a focused shopping experience.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Explore featured products, add favorites to cart, and continue to checkout when ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/products">Shop products</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/cart">View cart</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Featured catalog</p>
          <p className="mt-3 text-3xl font-semibold text-card-foreground">
            {products.length} products ready
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Featured products</h2>
            <p className="text-sm text-muted-foreground">A starter catalog that works with sample or live store data.</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/products">View all</Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-xl border bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 8).map((product) => {
              const image = product.image ?? product.images?.[0];
              return (
                <Link
                  key={product.id}
                  to="/products/$productId"
                  params={{ productId: product.id }}
                  className="group overflow-hidden rounded-xl border bg-card text-card-foreground"
                >
                  {image ? (
                    <img src={image} alt={product.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full bg-muted" />
                  )}
                  <div className="space-y-2 p-4">
                    <h3 className="font-medium group-hover:text-primary">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatMoney(resolveProductPrice(product))}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
