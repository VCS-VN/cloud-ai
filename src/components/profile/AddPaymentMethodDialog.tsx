import { useEffect, useRef, useState } from 'react'
import { loadStripe, type Stripe, type StripeCardElement } from '@stripe/stripe-js'
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { getPaymentConfig } from '@/server/functions/auth'
import type { PaymentConfig } from '@/auth/types'

type Tab = 'card' | 'paypal'

export function AddPaymentMethodDialog({
  open,
  onClose,
  onAdded
}: {
  open: boolean
  onClose: () => void
  onAdded?: () => void
}) {
  const getConfig = useServerFn(getPaymentConfig)
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('card')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setConfig(null)
    setDone(false)
    getConfig()
      .then((result) => {
        if (cancelled) return
        setConfig(result)
        setTab(result.stripe?.enabled ? 'card' : 'paypal')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(
          error instanceof Error ? error.message : 'Could not load payment options. Please try again.'
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, getConfig])

  if (!open) return null

  function handleSuccess() {
    setDone(true)
    onAdded?.()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add payment method"
    >
      <Button
        variant="unstyled"
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Close add payment method"
        onClick={onClose}
      />
      <section className="relative w-full max-w-[460px] rounded-modal border border-hairline bg-surface p-6 shadow-card">
        <p className="m-0 text-eyebrow uppercase text-subtle">Billing</p>
        <h2 className="m-0 mt-1.5 text-h3 font-semibold tracking-tight text-ink">Add payment method</h2>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-ui-sm text-muted">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Loading payment options…
          </div>
        ) : loadError ? (
          <p className="m-0 mt-4 rounded-input border border-hairline bg-danger-bg px-3 py-2 text-ui-sm text-danger-fg">
            {loadError}
          </p>
        ) : done ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-success-fg" />
            <p className="m-0 text-ui-sm text-ink">Payment method added.</p>
            <Button className="!h-9" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : config ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-0.5 rounded-md bg-ink/[0.05] p-0.5">
              {config.stripe?.enabled ? (
                <TabButton active={tab === 'card'} onClick={() => setTab('card')}>
                  <CreditCard aria-hidden="true" size={14} /> Card
                </TabButton>
              ) : null}
              {config.paypal?.enabled ? (
                <TabButton active={tab === 'paypal'} onClick={() => setTab('paypal')}>
                  PayPal
                </TabButton>
              ) : null}
            </div>

            <div className="mt-5">
              {tab === 'card' && config.stripe?.enabled ? (
                <StripeCardForm stripe={config.stripe} onSuccess={handleSuccess} />
              ) : null}
              {tab === 'paypal' && config.paypal?.enabled ? (
                <PaypalVaultForm paypal={config.paypal} onSuccess={handleSuccess} />
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded text-[12px] font-medium transition ${active ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
    >
      {children}
    </button>
  )
}

function StripeCardForm({
  stripe: stripeConfig,
  onSuccess
}: {
  stripe: PaymentConfig['stripe']
  onSuccess: () => void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<Stripe | null>(null)
  const cardRef = useRef<StripeCardElement | null>(null)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let card: StripeCardElement | null = null
    loadStripe(stripeConfig.publishable_key)
      .then((stripe) => {
        if (cancelled || !stripe || !mountRef.current) return
        stripeRef.current = stripe
        const elements = stripe.elements()
        card = elements.create('card', { hidePostalCode: true })
        cardRef.current = card
        card.mount(mountRef.current)
        card.on('ready', () => {
          if (!cancelled) setReady(true)
        })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the card form. Please try again.')
      })
    return () => {
      cancelled = true
      card?.destroy()
      cardRef.current = null
    }
  }, [stripeConfig.publishable_key])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const stripe = stripeRef.current
    const card = cardRef.current
    if (!stripe || !card || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: confirmError } = await stripe.confirmCardSetup(
      stripeConfig.setup_intent_client_secret,
      { payment_method: { card } }
    )
    setSubmitting(false)
    if (confirmError) {
      setError(confirmError.message ?? 'Could not save the card. Please try again.')
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-input border border-hairline bg-paper px-3 py-3">
        <div ref={mountRef} />
      </div>
      {error ? <p className="m-0 mt-2 text-ui-sm text-danger-fg">{error}</p> : null}
      <Button type="submit" className="mt-4 w-full !h-10" disabled={!ready || submitting}>
        {submitting ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Saving card…
          </>
        ) : (
          'Save card'
        )}
      </Button>
    </form>
  )
}

function PaypalVaultForm({
  paypal,
  onSuccess
}: {
  paypal: PaymentConfig['paypal']
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const braintree = await import('braintree-web')
      const client = await braintree.client.create({ authorization: paypal.vault_token })
      const paypalCheckout = await braintree.paypalCheckout.create({ client })
      await paypalCheckout.loadPayPalSDK({ vault: true })
      await new Promise<void>((resolve, reject) => {
        const win = window as unknown as { paypal?: any }
        if (!win.paypal) {
          reject(new Error('PayPal SDK failed to load.'))
          return
        }
        win.paypal
          .Buttons({
            createBillingAgreement: () => paypalCheckout.createPayment({ flow: 'vault' as any }),
            onApprove: async (data: unknown) => {
              await paypalCheckout.tokenizePayment(data as any)
              resolve()
            },
            onCancel: () => resolve(),
            onError: (err: unknown) => reject(err instanceof Error ? err : new Error('PayPal error'))
          })
          .render('#paypal-vault-button')
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect PayPal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="m-0 text-ui-sm text-muted">
        Connect a PayPal account to vault it for future charges.
      </p>
      <div id="paypal-vault-button" className="mt-4 min-h-[44px]" />
      {error ? <p className="m-0 mt-2 text-ui-sm text-danger-fg">{error}</p> : null}
      <Button type="button" className="mt-4 w-full !h-10" disabled={submitting} onClick={handleClick}>
        {submitting ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Connecting…
          </>
        ) : (
          'Connect PayPal'
        )}
      </Button>
    </div>
  )
}
