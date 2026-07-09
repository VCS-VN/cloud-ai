---
target: src/routes/orders.tsx
---
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Orders</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Order history</h1>
      <p className="mt-4 text-muted-foreground">This page is coming soon.</p>
    </main>
  );
}
