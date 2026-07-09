import { useEffect, useRef, useState } from 'react'
import { loadStripe, type Stripe, type StripeCardElement } from '@stripe/stripe-js'
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { getPaymentConfig } from '@/server/functions/auth'
import type { PaymentConfig } from '@/auth/types'
import { useTheme } from '@/theme'

type Tab = 'card' | 'paypal'

// PayPal vault_without_purchase needs a server-issued setup token + buyer
// user-id-token, which the EpisCloud payment-config endpoint does not provide
// yet (v1 attaches pre-vaulted pmt- tokens only). Keep the flow disabled until
// the backend exposes those, otherwise the button crashes at PayPal prebuild.
const PAYPAL_ENABLED = false

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
        setTab(result.stripe?.enabled || !PAYPAL_ENABLED ? 'card' : 'paypal')
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
              {PAYPAL_ENABLED && config.paypal?.enabled ? (
                <TabButton active={tab === 'paypal'} onClick={() => setTab('paypal')}>
                  PayPal
                </TabButton>
              ) : null}
            </div>

            <div className="mt-5">
              {tab === 'card' && config.stripe?.enabled ? (
                <StripeCardForm stripe={config.stripe} onSuccess={handleSuccess} />
              ) : null}
              {PAYPAL_ENABLED && tab === 'paypal' && config.paypal?.enabled ? (
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

// Stripe renders its card fields inside a cross-origin iframe, so app CSS and
// Tailwind classes can't reach the input text. The only way to theme it is the
// Elements `style` API. Read the resolved token RGBs off <html> at runtime so
// these stay in lockstep with tokens.css instead of hardcoding a second copy.
function readCardStyle() {
  const styles = getComputedStyle(document.documentElement)
  const rgb = (token: string, fallback: string) => {
    const value = styles.getPropertyValue(token).trim()
    return value ? `rgb(${value.replace(/\s+/g, ' ')})` : fallback
  }
  return {
    base: {
      color: rgb('--color-ink', '#0F0F10'),
      fontFamily:
        styles.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif',
      fontSize: '14px',
      '::placeholder': { color: rgb('--color-subtle', '#9B9892') },
      iconColor: rgb('--color-muted', '#75736E')
    },
    invalid: {
      color: rgb('--color-danger-fg', '#BE123C'),
      iconColor: rgb('--color-danger-fg', '#BE123C')
    }
  }
}

function StripeCardForm({
  stripe: stripeConfig,
  onSuccess
}: {
  stripe: PaymentConfig['stripe']
  onSuccess: () => void
}) {
  const { effectiveTheme } = useTheme()
  const mountRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<Stripe | null>(null)
  const cardRef = useRef<StripeCardElement | null>(null)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let card: StripeCardElement | null = null
    setReady(false)
    loadStripe(stripeConfig.publishable_key)
      .then((stripe) => {
        if (cancelled || !stripe || !mountRef.current) return
        stripeRef.current = stripe
        const elements = stripe.elements()
        card = elements.create('card', {
          hidePostalCode: true,
          style: readCardStyle()
        })
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
  }, [stripeConfig.publishable_key, effectiveTheme])

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

const PAYPAL_SDK_ID = 'paypal-sdk'

function loadPaypalSdk(clientId: string): Promise<any> {
  const win = window as unknown as { paypal?: any }
  if (win.paypal) return Promise.resolve(win.paypal)

  const existing = document.getElementById(PAYPAL_SDK_ID) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(win.paypal))
      existing.addEventListener('error', () => reject(new Error('PayPal SDK failed to load.')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = PAYPAL_SDK_ID
    const params = new URLSearchParams({
      'client-id': clientId,
      components: 'buttons'
    })
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`
    script.onload = () => resolve(win.paypal)
    script.onerror = () => reject(new Error('PayPal SDK failed to load.'))
    document.head.appendChild(script)
  })
}

function PaypalVaultForm({
  paypal,
  onSuccess
}: {
  paypal: PaymentConfig['paypal']
  onSuccess: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadPaypalSdk(paypal.client_id)
      .then((sdk) => {
        if (cancelled || !sdk || !containerRef.current) return
        containerRef.current.innerHTML = ''
        sdk
          .Buttons({
            createVaultSetupToken: () => paypal.vault_token,
            onApprove: () => {
              onSuccess()
            },
            onError: () => {
              if (!cancelled) setError('Could not connect PayPal. Please try again.')
            }
          })
          .render(containerRef.current)
          .catch(() => {
            if (!cancelled) setError('Could not render the PayPal button. Please try again.')
          })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not connect PayPal.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paypal.client_id, paypal.vault_token, onSuccess])

  return (
    <div>
      <p className="m-0 text-ui-sm text-muted">
        Connect a PayPal account to save it for future charges.
      </p>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-ui-sm text-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading PayPal…
        </div>
      ) : null}
      <div ref={containerRef} className="mt-4 min-h-[44px]" />
      {error ? <p className="m-0 mt-2 text-ui-sm text-danger-fg">{error}</p> : null}
    </div>
  )
}
