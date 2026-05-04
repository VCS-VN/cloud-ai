import { EmptyState } from '../common/EmptyState'
import type { ProjectFileNode } from '../../features/storefront-builder/types'

type FilePreviewPanelProps = {
  node?: ProjectFileNode
}

const safeTextTypes = new Set(['text/plain', 'application/json', 'application/manifest+json', 'text/javascript'])

export function FilePreviewPanel({ node }: FilePreviewPanelProps) {
  if (!node) return <EmptyState title="Chọn file hoặc folder" description="Metadata và preview an toàn sẽ hiển thị ở đây." />

  const childCount = node.children?.length ?? 0
  const canPreviewText = node.type === 'file' && node.content && node.contentType && safeTextTypes.has(node.contentType)

  return (
    <section className="rounded-lg border border-hairline bg-surface-soft p-md text-ink" aria-label="File metadata">
      <p className="m-0 font-mono text-caption uppercase tracking-[0.16em]">{node.type === 'folder' ? 'Folder metadata' : 'File metadata'}</p>
      <h2 className="mb-sm mt-xs break-words text-headline">{node.name}</h2>
      <dl className="grid gap-xs text-body-sm">
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em]">Path</dt>
          <dd className="m-0 break-all">{node.path}</dd>
        </div>
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em]">Type</dt>
          <dd className="m-0">{node.type}</dd>
        </div>
        {node.contentType ? (
          <div>
            <dt className="font-mono text-caption uppercase tracking-[0.12em]">Content type</dt>
            <dd className="m-0">{node.contentType}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em]">Updated</dt>
          <dd className="m-0">{new Date(node.updatedAt).toLocaleString('vi-VN')}</dd>
        </div>
        {node.type === 'folder' ? (
          <div>
            <dt className="font-mono text-caption uppercase tracking-[0.12em]">Children</dt>
            <dd className="m-0">{childCount}</dd>
          </div>
        ) : null}
      </dl>

      {canPreviewText ? (
        <pre className="mt-md max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-hairline bg-canvas p-md font-mono text-caption text-ink">
          {node.content}
        </pre>
      ) : node.type === 'file' ? (
        <p className="mt-md rounded-md bg-canvas p-md text-body-sm">Preview text không khả dụng cho file này. Metadata vẫn an toàn để xem.</p>
      ) : null}
    </section>
  )
}
