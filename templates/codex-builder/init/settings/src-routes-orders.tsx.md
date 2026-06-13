---
target: src/routes/orders.tsx
---
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Orders</p>
        <h1 className="text-4xl font-semibold tracking-tight">Order history</h1>
      </div>
      <section className="rounded-2xl border bg-card p-8 text-center">
        <p className="font-medium">No orders yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Completed orders will appear here when order persistence is connected.
        </p>
        <Link to="/products" className="mt-5 inline-flex text-sm font-medium text-primary">
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
