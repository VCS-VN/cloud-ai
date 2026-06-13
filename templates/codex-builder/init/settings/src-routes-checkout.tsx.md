---
target: src/routes/checkout.tsx
---
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    method: typeof search.method === "string" ? search.method : undefined,
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Checkout</p>
          <h1 className="text-4xl font-semibold tracking-tight">Shipping details</h1>
        </div>
        <form
          className="grid gap-4 rounded-2xl border bg-card p-5"
          onSubmit={(event) => {
            event.preventDefault();
            toast.success("Order placeholder submitted");
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Shipping address</Label>
            <Input id="address" name="address" autoComplete="street-address" />
          </div>
          <Button type="submit">Place order</Button>
        </form>
      </section>
      <aside className="h-fit rounded-2xl border bg-card p-5">
        <p className="text-sm font-medium">Order summary</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This checkout skeleton is ready for project-specific order logic.
        </p>
      </aside>
    </main>
  );
}
