import { EmptyState } from '../common/EmptyState'
import type { ProjectFileNode } from '@/shared/project-types'

type FilePreviewPanelProps = {
  node?: ProjectFileNode
}

const safeTextTypes = new Set(['text/plain', 'application/json', 'application/manifest+json', 'text/javascript'])

export function FilePreviewPanel({ node }: FilePreviewPanelProps) {
  if (!node) return <EmptyState title="Select a file or folder" description="Safe preview and metadata will appear here." />

  const childCount = node.children?.length ?? 0
  const canPreviewText = node.type === 'file' && node.content && node.contentType && safeTextTypes.has(node.contentType)

  return (
    <section className="builder-truncate-safe flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-md text-[var(--app-panel-text)] transition-colors duration-300" aria-label="File metadata">
      <p className="builder-kicker text-[var(--app-muted)]">{node.type === 'folder' ? 'Folder metadata' : 'File metadata'}</p>
      <h2 className="m-0 mt-xs text-[16px] font-[520] leading-tight tracking-[-0.015em]">{node.name}</h2>
      <dl className="mt-md grid gap-sm text-[12px] leading-4">
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--app-subtle-text)]">Path</dt>
          <dd className="m-0 break-all">{node.path}</dd>
        </div>
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--app-subtle-text)]">Type</dt>
          <dd className="m-0">{node.type}</dd>
        </div>
        {node.contentType ? (
          <div>
            <dt className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--app-subtle-text)]">Content type</dt>
            <dd className="m-0 break-all">{node.contentType}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--app-subtle-text)]">Updated</dt>
          <dd className="m-0">{new Date(node.updatedAt).toLocaleString('en-US')}</dd>
        </div>
        {node.type === 'folder' ? (
          <div>
            <dt className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--app-subtle-text)]">Children</dt>
            <dd className="m-0">{childCount}</dd>
          </div>
        ) : null}
      </dl>

      {canPreviewText ? (
        <pre className="mt-sm min-h-0 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-sm font-mono text-[12px] leading-4 text-[var(--app-panel-text)] [overflow-wrap:anywhere]">
          {node.content}
        </pre>
      ) : node.type === 'file' ? (
        <p className="mt-md rounded-md bg-[var(--app-control)] p-md text-[12px] leading-4 text-[var(--app-muted-text)]">Text preview is not available for this file. Metadata is still safe to view.</p>
      ) : null}
    </section>
  )
}
