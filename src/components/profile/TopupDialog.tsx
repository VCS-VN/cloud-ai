import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { topupBalance } from "@/server/functions/auth";
import type { PaymentMethod, TopupBalanceResult } from "@/auth/types";

const AMOUNT_CHIPS = [5, 10, 20, 50, 100] as const;

const balanceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function toMicroUsd(dollars: number) {
  return Math.round(dollars * 1_000_000);
}

export function TopupDialog({
  open,
  onClose,
  paymentMethods,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethod[];
  onSuccess?: (result: TopupBalanceResult) => void;
}) {
  const topup = useServerFn(topupBalance);
  const [amount, setAmount] = useState<string>(String(AMOUNT_CHIPS[1]));
  const amountNumber = Number(amount);
  const amountValid =
    amount.trim() !== "" && Number.isFinite(amountNumber) && amountNumber >= 1;
  const defaultMethodId = useMemo(
    () =>
      paymentMethods.find((method) => method.default)?.id ??
      paymentMethods[0]?.id ??
      "",
    [paymentMethods],
  );
  const [paymentMethodId, setPaymentMethodId] = useState(defaultMethodId);

  const mutation = useMutation({
    mutationFn: (variables: {
      amountMicroUsd: number;
      paymentMethodId: string;
    }) =>
      topup({
        data: {
          amountMicroUsd: variables.amountMicroUsd,
          reason: crypto.randomUUID(),
          paymentMethodId: variables.paymentMethodId || undefined,
        },
      }) as Promise<TopupBalanceResult>,
    onSuccess: (result) => {
      onSuccess?.(result);
    },
  });

  const resetMutation = mutation.reset;

  useEffect(() => {
    if (!open) return;
    setAmount(String(AMOUNT_CHIPS[1]));
    setPaymentMethodId(defaultMethodId);
    resetMutation();
  }, [open, defaultMethodId, resetMutation]);

  if (!open) return null;

  const done = mutation.isSuccess;
  const submitting = mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Top up balance"
    >
      <Button
        variant="unstyled"
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Close top up"
        disabled={submitting}
        onClick={onClose}
      />
      <section className="relative w-full max-w-[460px] rounded-modal border border-hairline bg-surface p-6 shadow-card">
        <p className="m-0 text-eyebrow uppercase text-subtle">Billing</p>
        <h2 className="m-0 mt-1.5 text-h3 font-semibold tracking-tight text-ink">
          Top up balance
        </h2>

        {done ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2
              aria-hidden="true"
              className="h-10 w-10 text-success-fg"
            />
            <p className="m-0 text-ui-sm text-ink">
              Added {balanceFormatter.format(amountNumber)} to your balance.
            </p>
            <p className="m-0 text-xs text-muted">
              New balance:{" "}
              {balanceFormatter.format(
                mutation.data.balance_micro_usd_after / 1_000_000,
              )}
            </p>
            <Button className="!h-9" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (submitting || !amountValid) return;
              mutation.mutate({
                amountMicroUsd: toMicroUsd(amountNumber),
                paymentMethodId,
              });
            }}
          >
            <p className="m-0 mt-4 text-xs font-medium text-muted">Amount</p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {AMOUNT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAmount(String(chip))}
                  className={`h-10 rounded-input border text-ui-sm font-medium transition ${
                    amountNumber === chip
                      ? "border-ink bg-ink text-paper"
                      : "border-hairline bg-paper text-ink hover:border-ink/30"
                  }`}
                >
                  ${chip}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center rounded-input border border-hairline bg-paper px-3 focus-within:border-ink">
              <span className="text-ui-sm text-subtle">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={0.1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-label="Top up amount in USD"
                className="ml-1 h-10 flex-1 bg-transparent text-ui-sm outline-none"
              />
            </div>
            {amount.trim() !== "" && !amountValid ? (
              <p className="m-0 mt-1.5 text-[11px] text-danger-fg">
                Enter an amount of at least $1.
              </p>
            ) : null}

            <p className="m-0 mt-5 text-xs font-medium text-muted">
              Payment method
            </p>
            {paymentMethods.length > 0 ? (
              <div className="mt-2 space-y-2">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-input border px-3 py-2.5 text-ui-sm transition ${
                      paymentMethodId === method.id
                        ? "border-ink bg-ink/[0.03]"
                        : "border-hairline bg-paper hover:border-ink/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="topup-payment-method"
                      value={method.id}
                      checked={paymentMethodId === method.id}
                      onChange={() => setPaymentMethodId(method.id)}
                      className="accent-ink"
                    />
                    <CreditCard
                      aria-hidden="true"
                      size={16}
                      className="text-muted"
                    />
                    <span className="text-ink">
                      {method.brand} •••• {method.last4}
                    </span>
                    {method.default ? (
                      <span className="ml-auto text-[11px] text-subtle">
                        Default
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : (
              <p className="m-0 mt-2 rounded-input border border-hairline bg-paper px-3 py-2.5 text-ui-sm text-muted">
                Add a payment method first to top up your balance.
              </p>
            )}

            {mutation.isError ? (
              <p className="m-0 mt-4 rounded-input border border-hairline bg-danger-bg px-3 py-2 text-ui-sm text-danger-fg">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Could not top up your balance. Please try again."}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                disabled={submitting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting || paymentMethods.length === 0 || !amountValid
                }
              >
                {submitting ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                    Adding
                  </>
                ) : amountValid ? (
                  `Add`
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
