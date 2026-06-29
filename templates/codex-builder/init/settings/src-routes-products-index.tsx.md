---
target: src/routes/products/index.tsx
---
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/app/store-provider";
import { useProductsList } from "@/services/store/use-products-list";
import { ProductCard } from "@/components/store/product-card";

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { storeDetail } = useStore();
  const {
    products,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useProductsList({ storeId: storeDetail?.id });

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Catalog</p>
        <h1 className="text-4xl font-semibold tracking-tight">Products</h1>
        <p className="max-w-2xl text-muted-foreground">
          Browse {total || products.length} available products from this storefront.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-xl border bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
