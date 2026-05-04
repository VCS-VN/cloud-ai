import { Clock3, ExternalLink, Heart } from 'lucide-react'
import type { Project } from '../../features/storefront-builder/types'

type ProjectListItemProps = {
  project: Project
  selected?: boolean
  variant?: 'grid' | 'list'
  onSelect: (projectId: string) => void
}

const statusLabel: Record<Project['status'], string> = {
  draft: 'Draft',
  generating: 'Generating',
  ready: 'Ready',
  failed: 'Failed'
}

export function ProjectListItem({ project, selected = false, variant = 'grid', onSelect }: ProjectListItemProps) {
  const summary = project.description || project.initialPrompt || 'No description yet.'
  const editedDate = new Date(project.updatedAt).toLocaleDateString('vi-VN')

  if (variant === 'list') {
    return (
      <button
        type="button"
        className={`flex w-full min-w-0 items-center gap-sm rounded-sm border p-sm text-left transition ${selected ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-control)]'}`}
        aria-pressed={selected}
        onClick={() => onSelect(project.id)}
      >
        <ProjectThumb name={project.name} compact />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-[520] leading-4 text-[var(--app-text)]">{project.name}</span>
          <span className="mt-xxs flex items-center gap-xs text-[12px] leading-4 text-[var(--app-muted)]">
            <Clock3 aria-hidden="true" size={13} />
            Edited {editedDate}
          </span>
        </span>
        <span className="rounded-pill bg-[var(--app-control)] px-sm py-xxs text-[12px] text-[var(--app-muted)]">{statusLabel[project.status]}</span>
        <ExternalLink aria-hidden="true" className="text-[var(--app-subtle)]" size={15} />
      </button>
    )
  }

  return (
    <button type="button" className="group min-w-0 border-0 bg-transparent p-0 text-left" aria-pressed={selected} onClick={() => onSelect(project.id)}>
      <ProjectThumb name={project.name} />
      <span className="mt-sm flex min-w-0 items-start gap-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-coral via-magenta to-lilac text-[12px] font-[700] text-white">
          {project.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-[520] leading-4 text-[var(--app-text)]">{project.name}</span>
          <span className="mt-xxs line-clamp-1 block text-[12px] leading-4 text-[var(--app-muted)]">Edited {editedDate} · {statusLabel[project.status]}</span>
          <span className="sr-only">{summary}</span>
        </span>
      </span>
    </button>
  )
}

function ProjectThumb({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] ${compact ? 'h-16 w-24' : 'aspect-[16/9] w-full'}`}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_34%)]" aria-hidden="true" />
      <Heart aria-hidden="true" className="opacity-55" size={compact ? 18 : 24} />
      <span className="sr-only">Preview for {name}</span>
    </span>
  )
}
