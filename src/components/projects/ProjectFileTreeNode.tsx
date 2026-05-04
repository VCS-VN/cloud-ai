import { ChevronRight, FileText, Folder, FolderOpen, Image } from 'lucide-react'
import type { ProjectFileNode } from '../../features/storefront-builder/types'

type ProjectFileTreeNodeProps = {
  node: ProjectFileNode
  selectedNodeId?: string
  expandedFolderIds?: Set<string>
  depth?: number
  query?: string
  variant?: 'default' | 'code'
  onToggleFolder?: (node: ProjectFileNode) => void
  onSelectNode: (node: ProjectFileNode) => void
}

export function ProjectFileTreeNode({ node, selectedNodeId, expandedFolderIds, depth = 0, query = '', variant = 'default', onToggleFolder, onSelectNode }: ProjectFileTreeNodeProps) {
  const selected = node.id === selectedNodeId
  const isFolder = node.type === 'folder'
  const expanded = isFolder ? (expandedFolderIds?.has(node.id) ?? true) : false
  const isCode = variant === 'code'
  const lowerQuery = query.trim().toLocaleLowerCase('vi-VN')
  const selfMatches = !lowerQuery || `${node.name} ${node.path}`.toLocaleLowerCase('vi-VN').includes(lowerQuery)
  const childMatches = node.children?.some((child) => matchesQuery(child, lowerQuery)) ?? false

  if (lowerQuery && !selfMatches && !childMatches) return null

  function handleClick() {
    if (isFolder && isCode) {
      onToggleFolder?.(node)
      return
    }
    onSelectNode(node)
  }

  const Icon = isFolder ? (expanded ? FolderOpen : Folder) : node.contentType?.startsWith('image/') ? Image : FileText

  return (
    <li className="list-none">
      <button
        type="button"
        className={`flex w-full min-w-0 items-center gap-xs rounded-md px-sm py-xs text-left text-[14px] leading-5 transition ${
          selected && !isFolder ? 'bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] text-[var(--app-text)]' : isCode ? 'text-[var(--app-muted)] hover:bg-[var(--app-control)] hover:text-[var(--app-text)]' : 'text-ink hover:bg-surface-soft'
        }`}
        style={{ paddingLeft: `calc(var(--space-sm) + ${depth} * var(--space-md))` }}
        aria-pressed={selected}
        onClick={handleClick}
      >
        {isFolder && isCode ? <ChevronRight className={`shrink-0 transition ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" size={14} /> : null}
        <Icon aria-hidden="true" className="shrink-0" size={15} />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      {isFolder && expanded && node.children?.length ? (
        <ul className="m-0 p-0">
          {node.children.map((child) => (
            <ProjectFileTreeNode key={child.id} node={child} selectedNodeId={selectedNodeId} expandedFolderIds={expandedFolderIds} depth={depth + 1} query={query} variant={variant} onToggleFolder={onToggleFolder} onSelectNode={onSelectNode} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function matchesQuery(node: ProjectFileNode, query: string): boolean {
  if (!query) return true
  if (`${node.name} ${node.path}`.toLocaleLowerCase('vi-VN').includes(query)) return true
  return node.children?.some((child) => matchesQuery(child, query)) ?? false
}
