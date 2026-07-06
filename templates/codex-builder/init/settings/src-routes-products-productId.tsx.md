---
target: src/routes/products/$productId.tsx
---
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { useCart } from "@/app/cart-provider";
import { useStore } from "@/app/store-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatMoney, resolveProductPrice } from "@/lib/format-money";
import { useProductDetail } from "@/services/store/use-product-detail";
import type { ProductModel } from "@/services/store/use-products-list";

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
  const { data: product, isLoading, isError, refetch } = useProductDetail(productId);
  const { storeDetail } = useStore();
  const { addItem, updateItemQuantity, getItemQuantity } = useCart();

  const currency = storeDetail?.setting?.currency ?? "AUD";

  // Model selector state — never auto-preselect; the shopper MUST choose.
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Build selectable options from product.models, falling back to defaultModel
  // as the single option when models is empty. Never call .map/.length on
  // product.models directly.
  const modelOptions = useMemo<ProductModel[]>(() => {
    const models = product?.models ?? [];
    if (models.length > 0) return models;
    return product?.defaultModel ? [product.defaultModel] : [];
  }, [product?.models, product?.defaultModel]);

  const selectedModel = modelOptions.find((m) => m.id === selectedModelId);

  const sanitizedDescriptions = useMemo(() => {
    const html = product?.descriptions ?? "";
    return typeof window !== "undefined" ? DOMPurify.sanitize(html) : escapeHtml(html);
  }, [product?.descriptions]);

  const displayPrice =
    selectedModel?.price ?? product?.defaultModel?.price ?? resolveProductPrice(product ?? {}) ?? 0;

  const existingQuantity = selectedModel?.id ? getItemQuantity(selectedModel.id) : 0;
  const isUpdate = existingQuantity > 0;

  // Select a model: set id and sync the quantity input to any existing cart
  // quantity for that model (event-driven only — never from an effect).
  const handleSelectModel = (model: ProductModel) => {
    setSelectedModelId(model.id);
    const cartQuantity = getItemQuantity(model.id);
    setQuantity(cartQuantity > 0 ? cartQuantity : 1);
  };

  const commitCart = () => {
    if (!selectedModel) {
      toast.error("Please choose a product option first");
      return;
    }
    if (!product) return;
    if (isUpdate) {
      updateItemQuantity(selectedModel.id, quantity);
      toast.success(quantity <= 0 ? "Removed from cart" : "Cart updated");
    } else {
      if (quantity <= 0) return;
      const payload = { product, model: selectedModel, quantity };
      addItem(payload);
      toast.success("Added to cart");
    }
    setSheetOpen(false);
  };

  if (isLoading) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl border bg-muted" />
          <div className="space-y-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="h-24 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </main>
    );
  }
  if (isError) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">We couldn't load this product.</h1>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </main>
    );
  }
  if (!product) {
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

  const modelPicker = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Choose an option</p>
      <div className="flex flex-wrap gap-2">
        {modelOptions.map((model) => {
          const active = selectedModelId === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => handleSelectModel(model)}
              aria-pressed={active}
              className={
                "rounded-full border px-4 py-2 text-sm transition-colors " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground")
              }
            >
              {model.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  const quantityStepper = (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-foreground">Quantity</span>
      <div className="inline-flex items-center rounded-md border">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Decrease quantity"
          onClick={() => setQuantity((q) => Math.max(0, q - 1))}
        >
          <Minus />
        </Button>
        <input
          type="text"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            setQuantity(digits === "" ? 0 : Math.max(0, Number(digits)));
          }}
          className="w-12 border-x bg-transparent py-2 text-center text-sm outline-none"
          aria-label="Quantity"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Increase quantity"
          onClick={() => setQuantity((q) => q + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );

  const cartButtonLabel = isUpdate
    ? quantity <= 0
      ? "Remove from cart"
      : "Update cart"
    : "Add to cart";

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-7xl gap-10 px-4 pt-10 pb-28 lg:grid-cols-2 md:pb-10">
      <div className="overflow-hidden rounded-3xl border bg-muted">
        {image ? (
          <img src={image} alt={product.name} className="aspect-square h-full w-full object-cover" />
        ) : null}
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
          <p className="text-2xl font-semibold">{formatMoney(displayPrice, { currency })}</p>
        </div>
        {sanitizedDescriptions ? (
          <div
            className="prose prose-sm max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizedDescriptions }}
          />
        ) : null}

        {/* Desktop: inline model chips + quantity + cart button (hidden below md). */}
        <div className="hidden space-y-5 md:block">
          {modelPicker}
          {quantityStepper}
          <Button className="w-full sm:w-auto" onClick={commitCart}>
            {cartButtonLabel}
          </Button>
        </div>
      </section>

      {/* Mobile: fixed bottom-sheet trigger (hidden at md+). The sheet may open
          before a model is chosen so the shopper can select inside it. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full">
              {selectedModel ? cartButtonLabel : "Select option"}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="space-y-5">
            <SheetHeader>
              <SheetTitle>{product.name}</SheetTitle>
            </SheetHeader>
            <p className="text-xl font-semibold">{formatMoney(displayPrice, { currency })}</p>
            {modelPicker}
            {quantityStepper}
            <Button className="w-full" onClick={commitCart}>
              {selectedModel ? cartButtonLabel : "Confirm"}
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}

