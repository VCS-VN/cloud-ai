---
target: src/routes/cart.tsx
---
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { useCart } from "@/app/cart-provider";
import { selectedCartItemIdsAtom } from "@/app/cart-selection";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { items, updateItemQuantity, removeItem, clearCart } = useCart();
  const [selectedIds, setSelectedIds] = useAtom(selectedCartItemIdsAtom);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );
  const subtotal = selectedItems.reduce((sum, item) => sum + item.model.price * item.quantity, 0);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Cart</p>
          <h1 className="text-4xl font-semibold tracking-tight">Your cart</h1>
        </div>
        {items.length > 0 ? <Button variant="outline" onClick={clearCart}>Clear all</Button> : null}
      </header>

      {items.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-lg font-medium">Your cart is empty.</p>
          <Button asChild className="mt-5">
            <Link to="/products">Continue shopping</Link>
          </Button>
        </section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border p-4 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setSelectedIds(event.target.checked ? items.map((item) => item.id) : [])}
              />
              Select all visible items
            </label>
            {items.map((item) => (
              <article key={item.id} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[96px_1fr_auto]">
                {item.product.image ? <img src={item.product.image} alt={item.product.name} className="h-24 w-24 rounded-lg object-cover" /> : <div className="h-24 w-24 rounded-lg bg-muted" />}
                <div className="space-y-2">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, item.id]))
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className="font-medium">{item.product.name}</span>
                  </label>
                  <p className="text-sm text-muted-foreground">{item.model.name}</p>
                  <p className="font-semibold">{formatMoney(item.model.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded border px-2" onClick={() => updateItemQuantity(item.id, item.quantity - 1)}>-</button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button type="button" className="rounded border px-2" onClick={() => updateItemQuantity(item.id, item.quantity + 1)}>+</button>
                  <button type="button" className="ml-2 text-sm text-muted-foreground" onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </article>
            ))}
          </section>
          <aside className="h-fit rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{selectedItems.length} selected items</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(subtotal)}</p>
            <Button
              className="mt-5 w-full"
              disabled={selectedItems.length === 0}
              onClick={() => void navigate({ to: "/checkout", search: { method: "cart" } })}
            >
              Checkout
            </Button>
          </aside>
        </div>
      )}
    </main>
  );
}
