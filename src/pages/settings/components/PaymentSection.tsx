import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Wallet } from "lucide-react";
import { AddPaymentMethodDialog } from "@/components/profile/AddPaymentMethodDialog";
import { BALANCE_SUMMARY_KEY } from "@/components/profile/BalanceSummaryCard";
import { TopupDialog } from "@/components/profile/TopupDialog";
import { Button } from "@/components/ui/button";
import { listPaymentMethods } from "@/server/functions/auth";
import type { AuthUserSummary, PaymentMethodsResult } from "@/auth/types";
import { PaymentCard } from "./PaymentCard";

export function PaymentSection({ user }: { user: AuthUserSummary }) {
  const [addOpen, setAddOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const activated = Boolean(user.episCloudTenantId);
  const queryClient = useQueryClient();
  const fetchPaymentMethods = useServerFn(listPaymentMethods);

  const methodsQuery = useQuery({
    queryKey: ["episcloud-payment-methods"],
    queryFn: () => fetchPaymentMethods() as Promise<PaymentMethodsResult>,
    enabled: activated,
    staleTime: 5 * 60 * 1000,
  });

  const paymentMethods = methodsQuery.data?.payment_methods ?? [];
  return (
    <section
      id="payment"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Payment methods
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Primary card is charged automatically on the{" "}
            <span className="font-mono">28th</span> each month.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="!h-9 shrink-0"
          disabled={!activated || paymentMethods.length === 0}
          onClick={() => setTopupOpen(true)}
        >
          <Wallet aria-hidden="true" size={14} /> Top up
        </Button>
      </header>
      <div className="space-y-3 p-6">
        {activated && methodsQuery.isPending ? (
          <div className="flex items-center gap-2 rounded-xl border border-hairline bg-paper p-4 text-ui-sm text-muted">
            <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            Loading payment methods…
          </div>
        ) : activated && methodsQuery.isError ? (
          <div className="space-y-3 rounded-xl border border-hairline bg-paper p-4">
            <p className="m-0 text-ui-sm leading-relaxed text-danger-fg">
              {methodsQuery.error instanceof Error
                ? methodsQuery.error.message
                : "Could not load your payment methods. Please try again."}
            </p>
            <button
              type="button"
              onClick={() => void methodsQuery.refetch()}
              className="h-8 px-2.5 text-xs text-muted hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : paymentMethods.length > 0 ? (
          paymentMethods.map((method) => (
            <PaymentCard
              key={method.id}
              brand={method.brand}
              title={`${method.brand} •••• ${method.last4}`}
              subtitle={`Expires ${method.expiry_month}/${method.expiry_year}`}
              badge={method.default ? "Default" : undefined}
              action="Edit"
            />
          ))
        ) : null}
        <button
          type="button"
          disabled={!activated}
          onClick={() => setAddOpen(true)}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-ui-sm font-medium text-muted hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-hairline disabled:hover:text-muted"
        >
          <Plus aria-hidden="true" size={16} />
          Add payment method
        </button>
        {!activated ? (
          <p className="m-0 text-center text-[11px] text-subtle">
            Activate EpisCloud in your profile to add a payment method.
          </p>
        ) : null}
        <AddPaymentMethodDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
        <TopupDialog
          open={topupOpen}
          onClose={() => setTopupOpen(false)}
          paymentMethods={paymentMethods}
          onSuccess={() =>
            void queryClient.invalidateQueries({
              queryKey: BALANCE_SUMMARY_KEY,
            })
          }
        />
      </div>
    </section>
  );
}
