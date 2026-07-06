import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CalendarDays, Camera, ImageIcon, Loader2, UserRound } from 'lucide-react'
import type { AuthUserSummary } from '@/auth/types'
import { UserMenu } from '@/components/auth/UserMenu'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { getCurrentUser, updateProfile } from '@/server/functions/auth'

export const Route = createFileRoute('/profile/')({
  beforeLoad: async () => {
    const { user } = await getCurrentUser()
    if (!user) throw redirect({ to: '/' })
    return { user }
  },
  component: ProfileSettingsPage
})

type FormState = {
  displayName: string
  bio: string
  photoUrl: string
  coverImage: string
  dateOfBirth: string
}

function toForm(user: AuthUserSummary): FormState {
  return {
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    photoUrl: user.photoUrl ?? '',
    coverImage: user.coverImage ?? '',
    dateOfBirth: user.dateOfBirth ?? ''
  }
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

function parseDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

function ProfileSettingsPage() {
  const { user } = Route.useRouteContext()
  const updateProfileFn = useServerFn(updateProfile)

  const [initial, setInitial] = useState<FormState>(() => toForm(user))
  const [form, setForm] = useState<FormState>(() => toForm(user))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  const dirty = (Object.keys(form) as Array<keyof FormState>).some((key) => form[key] !== initial[key])
  const hasName = form.displayName.trim().length > 0
  const previewName = hasName ? form.displayName.trim() : 'Your name'
  const initials = getInitials(hasName ? form.displayName : user.email)
  const selectedDate = parseDate(form.dateOfBirth)

  function setField<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setStatus('idle')
    if (key === 'photoUrl') setAvatarFailed(false)
    if (key === 'coverImage') setCoverFailed(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setStatus('idle')
    try {
      const updated = await updateProfileFn({ data: form })
      const next = toForm(updated)
      setInitial(next)
      setForm(next)
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setForm(initial)
    setStatus('idle')
    setAvatarFailed(false)
    setCoverFailed(false)
  }

  const showCover = form.coverImage.trim() && !coverFailed
  const showAvatar = form.photoUrl.trim() && !avatarFailed

  return (
    <main className="min-h-screen bg-paper p-4 text-ink sm:p-6">
      <div className="mx-auto grid max-w-3xl gap-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow m-0">Profile</p>
            <h1 className="m-0 mt-1 text-h2 font-semibold tracking-tight">Manage profile</h1>
          </div>
          <UserMenu user={user} />
        </header>

        {/* Preview card — cover + avatar + identity */}
        <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
          <div className="relative h-40 w-full overflow-hidden bg-chalk sm:h-44">
            {showCover ? (
              <img
                src={form.coverImage}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-chalk via-paper to-hairline text-subtle">
                <ImageIcon aria-hidden="true" className="h-5 w-5" />
                <span className="text-caption">Add a background image below</span>
              </div>
            )}
          </div>

          <div className="px-6 pb-5">
            <div className="-mt-11 flex items-end gap-4">
              <span className="relative inline-flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-h3 font-semibold text-paper ring-4 ring-surface">
                {showAvatar ? (
                  <img
                    src={form.photoUrl}
                    alt={`${previewName} avatar`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <span aria-hidden="true">{initials}</span>
                )}
              </span>
              <div className="min-w-0 pb-1.5">
                <h2
                  className={`m-0 truncate text-section-title font-semibold tracking-tight ${
                    hasName ? '' : 'text-subtle'
                  }`}
                >
                  {previewName}
                </h2>
                <p className="m-0 mt-0.5 truncate text-ui-sm text-muted">{user.email}</p>
              </div>
            </div>
            {form.bio.trim() ? (
              <p className="m-0 mt-3 max-w-prose whitespace-pre-line text-body leading-relaxed text-muted">
                {form.bio}
              </p>
            ) : null}
          </div>
        </section>

        {/* Edit form card */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
        >
          <div className="grid gap-5 p-6">
            <Field label="Display name" htmlFor="displayName" icon={UserRound}>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(event) => setField('displayName', event.target.value)}
                placeholder="Your name"
                maxLength={80}
              />
            </Field>

            <Field label="Bio" htmlFor="bio">
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(event) => setField('bio', event.target.value)}
                placeholder="A short description about you"
                rows={3}
                maxLength={280}
              />
              <span className="mt-1.5 block text-right text-caption text-subtle">
                {form.bio.length}/280
              </span>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Avatar URL" htmlFor="photoUrl" icon={Camera}>
                <Input
                  id="photoUrl"
                  type="url"
                  value={form.photoUrl}
                  onChange={(event) => setField('photoUrl', event.target.value)}
                  placeholder="https://…/avatar.png"
                />
              </Field>

              <Field label="Background image URL" htmlFor="coverImage" icon={ImageIcon}>
                <Input
                  id="coverImage"
                  type="url"
                  value={form.coverImage}
                  onChange={(event) => setField('coverImage', event.target.value)}
                  placeholder="https://…/cover.png"
                />
              </Field>
            </div>

            <Field label="Date of birth" htmlFor="dateOfBirth" icon={CalendarDays}>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="dateOfBirth"
                    type="button"
                    variant="outline"
                    className={`w-full justify-between font-normal sm:max-w-xs ${
                      selectedDate ? '' : 'text-subtle'
                    }`}
                  >
                    {selectedDate ? dateFormatter.format(selectedDate) : 'Pick a date'}
                    <CalendarDays aria-hidden="true" className="h-4 w-4 text-muted" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    defaultMonth={selectedDate}
                    captionLayout="dropdown"
                    startMonth={new Date(1920, 0)}
                    endMonth={new Date()}
                    disabled={{ after: new Date() }}
                    onSelect={(date) => {
                      setField('dateOfBirth', date ? toDateValue(date) : '')
                      setDateOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-hairline bg-chalk/40 px-6 py-3.5">
            <span aria-live="polite" className="text-ui-sm">
              {status === 'saved' ? <span className="text-success-fg">Profile saved.</span> : null}
              {status === 'error' ? (
                <span className="text-danger-fg">Could not save. Try again.</span>
              ) : null}
              {status === 'idle' && dirty ? (
                <span className="text-muted">Unsaved changes</span>
              ) : null}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleReset} disabled={!dirty || saving}>
                Reset
              </Button>
              <Button type="submit" disabled={!dirty || saving}>
                {saving ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}

function Field({
  label,
  htmlFor,
  icon: Icon,
  children
}: {
  label: string
  htmlFor: string
  icon?: typeof UserRound
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-ui-sm font-medium text-ink">
        {Icon ? <Icon aria-hidden="true" className="h-4 w-4 text-muted" /> : null}
        {label}
      </label>
      {children}
    </div>
  )
}
