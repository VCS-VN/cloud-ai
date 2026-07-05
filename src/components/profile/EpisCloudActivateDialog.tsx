import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EpisCloudActivateDialog({
  open,
  activating = false,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean
  activating?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Activate EpisCloud confirmation"
    >
      <Button
        variant="unstyled"
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Cancel EpisCloud activation"
        disabled={activating}
        onClick={onCancel}
      />
      <section className="relative w-full max-w-[420px] rounded-modal border border-hairline bg-surface p-6 shadow-card">
        <p className="m-0 text-eyebrow uppercase text-subtle">Confirm activation</p>
        <h2 className="m-0 mt-1.5 text-h3 font-semibold tracking-tight text-ink">
          Activate EpisCloud?
        </h2>
        <p className="m-0 mt-2 text-body leading-relaxed text-muted">
          This creates a live EpisCloud account tied to your profile. You can&apos;t undo this from here.
        </p>
        {error ? (
          <p className="m-0 mt-3 rounded-input border border-hairline bg-danger-bg px-2 py-1 text-ui-sm text-danger-fg">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" disabled={activating} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={activating} onClick={onConfirm}>
            {activating ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Activating…
              </>
            ) : (
              'Activate'
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}
