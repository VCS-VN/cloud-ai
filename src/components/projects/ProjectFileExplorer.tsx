import { Search } from 'lucide-react'
import { EmptyState } from '../common/EmptyState'
import { ErrorState } from '../common/ErrorState'
import { LoadingState } from '../common/LoadingState'
import type { ProjectFileNode } from '../../features/storefront-builder/types'
import { ProjectFileTreeNode } from './ProjectFileTreeNode'

type ProjectFileExplorerProps = {
  fileTree: ProjectFileNode[]
  selectedNodeId?: string
  loading?: boolean
  error?: string
  expandedFolderIds?: Set<string>
  query?: string
  variant?: 'default' | 'code'
  onQueryChange?: (query: string) => void
  onToggleFolder?: (node: ProjectFileNode) => void
  onSelectNode: (node: ProjectFileNode) => void
}

export function ProjectFileExplorer({ fileTree, selectedNodeId, loading = false, error, expandedFolderIds, query = '', variant = 'default', onQueryChange, onToggleFolder, onSelectNode }: ProjectFileExplorerProps) {
  if (loading) return <LoadingState label="Đang tải cấu trúc..." />
  if (error) return <ErrorState title="Không tải được cấu trúc" message={error} />
  if (fileTree.length === 0) {
    return <EmptyState title="Chưa có cấu trúc" description="Các trang và file tạo ra sẽ xuất hiện tại đây." />
  }

  const isCode = variant === 'code'

  return (
    <section className={`min-w-0 rounded-sm border p-sm ${isCode ? 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)]' : 'border-hairline bg-canvas'}`} aria-label="Project file explorer">
      <div className="mb-sm flex items-center justify-between gap-sm px-xs">
        <h2 className="m-0 text-[14px] font-[520] leading-tight tracking-[-0.015em]">{isCode ? 'Files' : 'Structure'}</h2>
        {!isCode ? <span className="rounded-pill bg-surface-soft px-sm py-xxs font-mono text-caption uppercase tracking-[0.12em]">Virtual</span> : null}
      </div>
      {isCode ? (
        <label className="mb-sm flex h-9 items-center gap-xs rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-muted)]">
          <Search aria-hidden="true" size={15} />
          <span className="sr-only">Search code</span>
          <input className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-subtle)]" value={query} placeholder="Search code" onChange={(event) => onQueryChange?.(event.target.value)} />
        </label>
      ) : null}
      <ul className="m-0 flex flex-col gap-xxs p-0">
        {fileTree.map((node) => (
          <ProjectFileTreeNode key={node.id} node={node} selectedNodeId={selectedNodeId} expandedFolderIds={expandedFolderIds} depth={0} variant={variant} query={query} onToggleFolder={onToggleFolder} onSelectNode={onSelectNode} />
        ))}
      </ul>
    </section>
  )
}
