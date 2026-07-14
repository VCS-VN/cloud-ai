import { ChevronRight, FileText, Folder, FolderOpen, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectFileNode } from '@/shared/project-types'

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
  const lowerQuery = query.trim().toLocaleLowerCase('en-US')
  const selfMatches = !lowerQuery || `${node.name} ${node.path}`.toLocaleLowerCase('en-US').includes(lowerQuery)
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
      <Button
        variant="unstyled"
        type="button"
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] leading-4 transition-all duration-200 ${
          selected && !isFolder ? 'bg-ink/[0.06] font-medium text-ink [&_svg]:text-ink' : 'text-muted hover:bg-ink/[0.04] hover:text-ink [&_svg]:text-subtle hover:[&_svg]:text-ink'
        }`}
        style={{ paddingLeft: `calc(0.5rem + ${depth} * 0.75rem)` }}
        aria-pressed={selected}
        onClick={handleClick}
      >
        {isFolder && isCode ? <ChevronRight className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" size={14} /> : null}
        <Icon aria-hidden="true" className="shrink-0" size={15} />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </Button>
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
  if (`${node.name} ${node.path}`.toLocaleLowerCase('en-US').includes(query)) return true
  return node.children?.some((child) => matchesQuery(child, query)) ?? false
}
