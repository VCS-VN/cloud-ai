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
  onSelectNode: (node: ProjectFileNode) => void
}

export function ProjectFileExplorer({ fileTree, selectedNodeId, loading = false, error, onSelectNode }: ProjectFileExplorerProps) {
  if (loading) return <LoadingState label="Đang tải file tree..." />
  if (error) return <ErrorState title="Không tải được files" message={error} />
  if (fileTree.length === 0) {
    return <EmptyState title="Chưa có files" description="Cấu trúc storefront ảo sẽ xuất hiện sau khi project được tạo." />
  }

  return (
    <section className="rounded-lg border border-hairline bg-canvas p-sm" aria-label="Project file explorer">
      <div className="mb-sm flex items-center justify-between gap-sm px-xs">
        <h2 className="m-0 text-headline">Files</h2>
        <span className="rounded-pill bg-surface-soft px-sm py-xxs font-mono text-caption uppercase tracking-[0.12em]">Virtual</span>
      </div>
      <ul className="m-0 flex flex-col gap-xxs p-0">
        {fileTree.map((node) => (
          <ProjectFileTreeNode key={node.id} node={node} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />
        ))}
      </ul>
    </section>
  )
}
