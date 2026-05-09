import { Clock3, ExternalLink, Heart, Loader2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Project } from '@/shared/project-types'

type ProjectListItemProps = {
  project: Project
  selected?: boolean
  variant?: 'grid' | 'list'
  onSelect: (projectId: string) => void
  onDelete?: (projectId: string) => Promise<void> | void
}

const statusLabel: Record<Project['status'], string> = {
  0: 'Inactive',
  draft: 'Draft',
  generating: 'Generating',
  ready: 'Ready',
  failed: 'Failed'
}

export function ProjectListItem({ project, selected = false, variant = 'grid', onSelect, onDelete }: ProjectListItemProps) {
  const summary = project.description || project.initialPrompt || 'No description yet.'
  const editedDate = new Date(project.updatedAt).toLocaleDateString('en-US')
  const isProcessing = project.processingStatus === 'processing'
  const statusText = isProcessing ? 'Processing' : statusLabel[project.status]
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!onDelete) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    try {
      await onDelete(project.id)
    } finally {
      setDeleting(false)
    }
  }

  if (variant === 'list') {
    return (
      <article className={`flex w-full min-w-0 items-center gap-sm rounded-md border p-sm transition-all duration-200 ${selected ? 'border-[var(--app-accent)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-control)]'}`}>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-sm rounded-sm border-0 bg-transparent p-0 text-left text-current outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]" aria-pressed={selected} onClick={() => onSelect(project.id)}>
          <ProjectThumb name={project.name} compact />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-[520] leading-4 text-current">{project.name}</span>
            <span className={`mt-xxs line-clamp-1 block text-[12px] leading-4 ${selected ? 'text-current opacity-75' : 'text-[var(--app-muted)]'}`}>{summary}</span>
            <span className="mt-xxs flex items-center gap-xs text-[12px] leading-4 text-current opacity-70 [&_svg]:text-current">
              <Clock3 aria-hidden="true" size={13} />
              Edited {editedDate}
            </span>
          </span>
          <ProjectStatusBadge selected={selected} status={statusText} />
          <ExternalLink aria-hidden="true" className={selected ? 'text-[var(--app-icon-selected)]' : 'text-[var(--app-icon-subtle)]'} size={15} />
        </button>
        {onDelete ? <DeleteButton confirming={confirmingDelete} deleting={deleting} onCancel={() => setConfirmingDelete(false)} onDelete={handleDelete} /> : null}
      </article>
    )
  }

  return (
    <article className={`group relative min-w-0 overflow-hidden rounded-md border transition-all duration-200 ${selected ? 'border-[var(--app-accent)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-control)]'}`}>
      <button type="button" className="block w-full min-w-0 border-0 bg-transparent p-sm text-left text-current outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-focus-ring)]" aria-pressed={selected} onClick={() => onSelect(project.id)}>
        <ProjectThumb name={project.name} />
        <span className="mt-sm flex min-w-0 items-start gap-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-block-lilac)] text-[12px] font-[700] text-[var(--app-on-color-block)]">
            {project.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-start justify-between gap-xs">
              <span className="block min-w-0 truncate text-[13px] font-[560] leading-4 text-current">{project.name}</span>
              <ExternalLink aria-hidden="true" className={`mt-[1px] shrink-0 ${selected ? 'text-[var(--app-icon-selected)]' : 'text-[var(--app-icon-subtle)]'}`} size={14} />
            </span>
            <span className={`mt-xxs line-clamp-2 block text-[12px] leading-4 ${selected ? 'text-current opacity-75' : 'text-[var(--app-muted)]'}`}>{summary}</span>
            <span className="mt-xs flex flex-wrap items-center gap-xs text-[12px] leading-4 text-current opacity-70 [&_svg]:text-current">
              <span className="inline-flex items-center gap-xxs">
                <Clock3 aria-hidden="true" size={13} />
                Edited {editedDate}
              </span>
              <ProjectStatusBadge selected={selected} status={statusText} />
            </span>
          </span>
        </span>
      </button>
      {onDelete ? <div className="absolute right-xs top-xs opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><DeleteButton confirming={confirmingDelete} deleting={deleting} onCancel={() => setConfirmingDelete(false)} onDelete={handleDelete} /></div> : null}
    </article>
  )
}

function ProjectStatusBadge({ selected, status }: { selected: boolean; status: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-pill px-xs py-xxs text-[11px] font-[520] leading-none ${selected ? 'bg-[rgb(255_255_255_/_0.18)] text-current' : 'bg-[var(--app-control)] text-[var(--app-muted)] ring-1 ring-[var(--app-border)]'}`}>
      {status}
    </span>
  )
}

function DeleteButton({ confirming, deleting, onCancel, onDelete }: { confirming: boolean; deleting: boolean; onCancel: () => void; onDelete: () => void }) {
  return (
    <span className="inline-flex items-center gap-xxs rounded-pill bg-[var(--app-panel)] p-xxs text-red-500 ring-1 ring-red-300 transition-colors duration-200">
      {confirming ? (
        <button className="inline-flex h-7 items-center gap-xxs rounded-pill px-xs text-[11px] font-[520] text-red-500 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onDelete} disabled={deleting} aria-busy={deleting}>
          {deleting ? <Loader2 aria-hidden="true" className="animate-spin" size={12} /> : <Trash2 aria-hidden="true" size={12} />}
          Delete
        </button>
      ) : (
        <button className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-500 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]" type="button" onClick={onDelete} aria-label="Delete project">
          <Trash2 aria-hidden="true" size={14} />
        </button>
      )}
      {confirming ? <button className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-muted)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]" type="button" onClick={onCancel} disabled={deleting} aria-label="Cancel delete"><X aria-hidden="true" size={13} /></button> : null}
    </span>
  )
}

function ProjectThumb({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--color-hairline)] bg-[var(--color-block-cream)] text-[var(--app-on-color-block)] ${compact ? 'h-16 w-24' : 'aspect-[16/9] w-full'}`}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgb(255_255_255_/_0.55),transparent_28%),linear-gradient(135deg,rgb(255_255_255_/_0.22),transparent_55%)]" aria-hidden="true" />
      <Heart aria-hidden="true" className="relative text-[var(--app-icon-on-color-block)] opacity-60" size={compact ? 18 : 24} />
      <span className="sr-only">Preview for {name}</span>
    </span>
  )
}
