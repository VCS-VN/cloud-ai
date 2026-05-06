import { Clock3, ExternalLink, Heart, Loader2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Project } from '@/shared/storefront-builder-types'

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
      <div className={`flex w-full min-w-0 items-center gap-sm rounded-md border p-md transition ${selected ? 'border-[var(--app-accent)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-control)]'}`}>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-sm border-0 bg-transparent p-0 text-left text-current" aria-pressed={selected} onClick={() => onSelect(project.id)}>
          <ProjectThumb name={project.name} compact />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-[520] leading-4 text-current">{project.name}</span>
            <span className="mt-xxs flex items-center gap-xs text-[12px] leading-4 text-current opacity-70 [&_svg]:text-current">
              <Clock3 aria-hidden="true" size={13} />
              Edited {editedDate}
            </span>
          </span>
          {project.status !== 0 && <span className="rounded-pill bg-[var(--app-control)] px-sm py-xxs text-[12px] text-current opacity-70">{statusLabel[project.status]}</span>}
          <ExternalLink aria-hidden="true" className="text-[var(--app-icon-subtle)]" size={15} />
        </button>
        {onDelete ? <DeleteButton confirming={confirmingDelete} deleting={deleting} onCancel={() => setConfirmingDelete(false)} onDelete={handleDelete} /> : null}
      </div>
    )
  }

  return (
    <div className="group relative min-w-0">
      <button type="button" className="w-full min-w-0 border-0 bg-transparent p-0 text-left" aria-pressed={selected} onClick={() => onSelect(project.id)}>
        <ProjectThumb name={project.name} />
      </button>
      {onDelete ? <div className="absolute right-xs top-xs"><DeleteButton confirming={confirmingDelete} deleting={deleting} onCancel={() => setConfirmingDelete(false)} onDelete={handleDelete} /></div> : null}
      <button type="button" className="mt-sm flex w-full min-w-0 items-start gap-sm border-0 bg-transparent p-0 text-left" onClick={() => onSelect(project.id)}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-block-lilac)] text-[12px] font-[700] text-[var(--app-on-color-block)]">
          {project.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-[520] leading-4 text-current">{project.name}</span>
          <span className="mt-xxs line-clamp-1 block text-[12px] leading-4 text-[var(--app-muted)]">Edited {editedDate}{project.status !== 0 ? ` · ${statusLabel[project.status]}` : ''}</span>
          <span className="sr-only">{summary}</span>
        </span>
      </button>
    </div>
  )
}

function DeleteButton({ confirming, deleting, onCancel, onDelete }: { confirming: boolean; deleting: boolean; onCancel: () => void; onDelete: () => void }) {
  return (
    <span className="inline-flex items-center gap-xxs rounded-pill bg-[var(--app-panel)] p-xxs text-[var(--app-danger-text)] ring-1 ring-[var(--app-border)] transition-colors duration-200">
      {confirming ? (
        <button className="inline-flex h-7 items-center gap-xxs rounded-pill px-xs text-[11px] font-[520] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onDelete} disabled={deleting} aria-busy={deleting}>
          {deleting ? <Loader2 aria-hidden="true" className="animate-spin" size={12} /> : <Trash2 aria-hidden="true" size={12} />}
          Delete
        </button>
      ) : (
        <button className="inline-flex h-7 w-7 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]" type="button" onClick={onDelete} aria-label="Delete project">
          <Trash2 aria-hidden="true" className="text-[var(--app-icon-muted)]" size={14} />
        </button>
      )}
      {confirming ? <button className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-muted)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]" type="button" onClick={onCancel} disabled={deleting} aria-label="Cancel delete"><X aria-hidden="true" size={13} /></button> : null}
    </span>
  )
}

function ProjectThumb({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-block-cream)] text-[var(--app-on-color-block)] ${compact ? 'h-16 w-24' : 'aspect-[16/9] w-full'}`}>
      <span className="absolute inset-0 bg-transparent" aria-hidden="true" />
      <Heart aria-hidden="true" className="text-[var(--app-icon-on-color-block)] opacity-55" size={compact ? 18 : 24} />
      <span className="sr-only">Preview for {name}</span>
    </span>
  )
}
