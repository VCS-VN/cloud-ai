import { EmptyState } from '../common/EmptyState'
import type { ProjectFileNode } from '@/features/storefront-builder/types'

type FilePreviewPanelProps = {
  node?: ProjectFileNode
}

const safeTextTypes = new Set(['text/plain', 'application/json', 'application/manifest+json', 'text/javascript'])

export function FilePreviewPanel({ node }: FilePreviewPanelProps) {
  if (!node) return <EmptyState title="Chọn file hoặc folder" description="Preview an toàn và metadata sẽ hiển thị ở đây." />

  const childCount = node.children?.length ?? 0
  const canPreviewText = node.type === 'file' && node.content && node.contentType && safeTextTypes.has(node.contentType)

  return (
    <section className="builder-truncate-safe min-w-0 rounded-sm border border-hairline bg-surface-soft p-md text-ink" aria-label="File metadata">
      <p className="builder-kicker text-ink/55">{node.type === 'folder' ? 'Folder metadata' : 'File metadata'}</p>
      <h2 className="m-0 mt-xs text-[16px] font-[520] leading-tight tracking-[-0.015em]">{node.name}</h2>
      <dl className="mt-md grid gap-sm text-[12px] leading-4">
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em] text-ink/48">Path</dt>
          <dd className="m-0 break-all">{node.path}</dd>
        </div>
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em] text-ink/48">Type</dt>
          <dd className="m-0">{node.type}</dd>
        </div>
        {node.contentType ? (
          <div>
            <dt className="font-mono text-caption uppercase tracking-[0.12em] text-ink/48">Content type</dt>
            <dd className="m-0 break-all">{node.contentType}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em] text-ink/48">Updated</dt>
          <dd className="m-0">{new Date(node.updatedAt).toLocaleString('vi-VN')}</dd>
        </div>
        {node.type === 'folder' ? (
          <div>
            <dt className="font-mono text-caption uppercase tracking-[0.12em] text-ink/48">Children</dt>
            <dd className="m-0">{childCount}</dd>
          </div>
        ) : null}
      </dl>

      {canPreviewText ? (
        <pre className="mt-md max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-hairline bg-canvas p-md font-mono text-[12px] leading-4 text-ink">
          {node.content}
        </pre>
      ) : node.type === 'file' ? (
        <p className="mt-md rounded-sm bg-canvas p-md text-[12px] leading-4 text-ink/70">Preview text không khả dụng cho file này. Metadata vẫn an toàn để xem.</p>
      ) : null}
    </section>
  )
}
