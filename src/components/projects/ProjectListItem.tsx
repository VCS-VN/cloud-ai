import type { Project } from '../../features/storefront-builder/types'

type ProjectListItemProps = {
  project: Project
  selected?: boolean
  onSelect: (projectId: string) => void
}

const statusLabel: Record<Project['status'], string> = {
  draft: 'Nháp',
  generating: 'Đang tạo',
  ready: 'Sẵn sàng',
  failed: 'Lỗi'
}

export function ProjectListItem({ project, selected = false, onSelect }: ProjectListItemProps) {
  const summary = project.description || project.initialPrompt

  return (
    <button
      type="button"
      className={`w-full rounded-lg border p-md text-left transition ${
        selected ? 'border-ink bg-ink text-on-primary' : 'border-hairline bg-canvas text-ink hover:border-ink'
      }`}
      aria-pressed={selected}
      onClick={() => onSelect(project.id)}
    >
      <span className="mb-xs flex items-center justify-between gap-sm">
        <span className="min-w-0 truncate text-card-title">{project.name}</span>
        <span className={`shrink-0 rounded-pill px-sm py-xxs font-mono text-caption ${selected ? 'bg-on-primary text-ink' : 'bg-surface-soft text-ink'}`}>
          {statusLabel[project.status]}
        </span>
      </span>
      <span className="block overflow-hidden text-ellipsis text-body-sm">{summary}</span>
      <span className="mt-sm block font-mono text-caption uppercase tracking-[0.12em]">
        Cập nhật {new Date(project.updatedAt).toLocaleDateString('vi-VN')}
      </span>
    </button>
  )
}
