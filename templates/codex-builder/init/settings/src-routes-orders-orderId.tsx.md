---
target: src/routes/orders/$orderId.tsx
---
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Order</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{orderId}</h1>
      <p className="mt-4 text-muted-foreground">This page is coming soon.</p>
    </main>
  );
}
