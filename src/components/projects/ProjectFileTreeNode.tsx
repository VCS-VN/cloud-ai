import type { ProjectFileNode } from '../../features/storefront-builder/types'

type ProjectFileTreeNodeProps = {
  node: ProjectFileNode
  selectedNodeId?: string
  depth?: number
  onSelectNode: (node: ProjectFileNode) => void
}

export function ProjectFileTreeNode({ node, selectedNodeId, depth = 0, onSelectNode }: ProjectFileTreeNodeProps) {
  const selected = node.id === selectedNodeId
  const icon = node.type === 'folder' ? '▾' : '•'
  const label = node.type === 'folder' ? 'Folder' : 'File'

  return (
    <li className="list-none">
      <button
        type="button"
        className={`flex w-full items-center gap-xs rounded-md px-sm py-xs text-left text-body-sm transition ${
          selected ? 'bg-ink text-on-primary' : 'text-ink hover:bg-surface-soft'
        }`}
        style={{ paddingLeft: `calc(var(--space-sm) + ${depth} * var(--space-md))` }}
        aria-pressed={selected}
        onClick={() => onSelectNode(node)}
      >
        <span className="font-mono text-caption" aria-hidden="true">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className={`rounded-pill px-xs py-xxs font-mono text-caption ${selected ? 'bg-on-primary text-ink' : 'bg-surface-soft text-ink'}`}>
          {label}
        </span>
      </button>
      {node.children?.length ? (
        <ul className="m-0 p-0">
          {node.children.map((child) => (
            <ProjectFileTreeNode key={child.id} node={child} selectedNodeId={selectedNodeId} depth={depth + 1} onSelectNode={onSelectNode} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
