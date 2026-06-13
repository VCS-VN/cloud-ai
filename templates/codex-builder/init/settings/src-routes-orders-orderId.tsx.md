---
target: src/routes/orders/$orderId.tsx
---
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();

  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl space-y-6 px-4 py-10">
      <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground">
        Back to orders
      </Link>
      <section className="rounded-2xl border bg-card p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Order</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{orderId}</h1>
        <p className="mt-4 text-muted-foreground">
          Order detail data is ready to be connected to the live commerce API.
        </p>
      </section>
    </main>
  );
}
