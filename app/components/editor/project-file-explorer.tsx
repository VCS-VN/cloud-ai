import { useMemo } from "react";
import type { ProjectFileNode } from "@/shared/project-types";

interface ProjectFileExplorerProps {
  fileTree: ProjectFileNode[];
  selectedNodeId?: string;
  expandedFolderIds: Set<string>;
  query: string;
  variant?: "code" | "preview";
  onQueryChange: (query: string) => void;
  onToggleFolder: (node: ProjectFileNode) => void;
  onSelectNode: (node: ProjectFileNode) => void;
}

function FolderIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <path
        d="M2 4C2 3.44772 2.44772 3 3 3H6L8 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z"
        fill="currentColor"
        opacity="0.24"
      />
      {expanded && (
        <path
          d="M2 6H14V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V6Z"
          fill="currentColor"
          opacity="0.16"
        />
      )}
    </svg>
  );
}

function FileIconNode({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    ts: "var(--app-icon-muted)",
    tsx: "var(--app-icon-muted)",
    js: "var(--app-icon)",
    jsx: "var(--app-icon)",
    css: "var(--app-icon-muted)",
    json: "var(--app-icon)",
    md: "var(--app-icon-muted)",
    html: "var(--app-icon)",
  };
  const color = colorMap[ext ?? ""] ?? "var(--app-icon-subtle)";

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      style={{ color }}
    >
      <path d="M4 2H9L12 5V14H4V2Z" fill="currentColor" opacity="0.18" />
      <path d="M9 2V5H12" fill="currentColor" opacity="0.32" />
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  selectedNodeId,
  expandedFolderIds,
  query,
  onToggleFolder,
  onSelectNode,
}: {
  node: ProjectFileNode;
  depth: number;
  selectedNodeId?: string;
  expandedFolderIds: Set<string>;
  query: string;
  onToggleFolder: (node: ProjectFileNode) => void;
  onSelectNode: (node: ProjectFileNode) => void;
}) {
  const isExpanded = expandedFolderIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isFolder = node.type === "folder";
  const children = node.children ?? [];

  // Highlight matching text
  const highlightMatch = (name: string) => {
    if (!query) return name;
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark className="bg-[var(--app-selected-bg)] text-[var(--app-selected-text)] rounded px-[1px]">
          {name.slice(idx, idx + query.length)}
        </mark>
        {name.slice(idx + query.length)}
      </>
    );
  };

  return (
    <>
      {/* Tree node row */}
      <button
        type="button"
        onClick={() => {
          if (isFolder) {
            onToggleFolder(node);
          } else {
            onSelectNode(node);
          }
        }}
        className={`flex w-full items-center gap-xs rounded-md py-xs text-body-sm transition-colors duration-150 ${
          isSelected
            ? "bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]"
            : "text-[var(--app-text)] hover:bg-[var(--app-surface)]"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.name}
      >
        {isFolder ? (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`flex-shrink-0 text-[var(--app-icon-muted)] transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
            >
              <path
                d="M4 2L8 6L4 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <FolderIcon expanded={isExpanded} />
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            <FileIconNode name={node.name} />
          </>
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {highlightMatch(node.name)}
        </span>
      </button>

      {/* Children */}
      {isFolder && isExpanded && children.length > 0 && (
        <>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              expandedFolderIds={expandedFolderIds}
              query={query}
              onToggleFolder={onToggleFolder}
              onSelectNode={onSelectNode}
            />
          ))}
        </>
      )}
    </>
  );
}

export function ProjectFileExplorer({
  fileTree,
  selectedNodeId,
  expandedFolderIds,
  query,
  variant = "code",
  onQueryChange,
  onToggleFolder,
  onSelectNode,
}: ProjectFileExplorerProps) {
  // Build tree structure from flat list
  const treeNodes = useMemo(() => {
    const nodeMap = new Map<string, ProjectFileNode>();
    const roots: ProjectFileNode[] = [];

    // Index all nodes
    for (const node of fileTree) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    // Build hierarchy
    for (const node of fileTree) {
      const currentNode = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(currentNode);
      } else {
        roots.push(currentNode);
      }
    }

    return roots;
  }, [fileTree]);

  // Filter nodes by query
  const filterByQuery = (
    nodes: ProjectFileNode[],
    q: string,
  ): ProjectFileNode[] => {
    if (!q) return nodes;
    return nodes.reduce<ProjectFileNode[]>((acc, node) => {
      const matchesName = node.name.toLowerCase().includes(q.toLowerCase());
      const children = node.children ? filterByQuery(node.children, q) : [];
      if (matchesName || children.length > 0) {
        acc.push({ ...node, children });
      }
      return acc;
    }, []);
  };

  const filteredTree = useMemo(
    () => filterByQuery(treeNodes, query),
    [treeNodes, query],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="flex-shrink-0 flex items-center gap-xs px-sm py-xs">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 text-[var(--app-icon-muted)]"
        >
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9 9L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search files..."
          className="flex-1 rounded-md border border-transparent bg-transparent px-xs py-[1px] text-body-sm text-[var(--app-text)] placeholder:text-[var(--app-subtle)] outline-none transition-colors duration-150 hover:border-[var(--app-border)] focus:border-[var(--app-border)] focus:bg-[var(--app-control)]"
          aria-label="Search files"
        />
      </div>

      {/* File tree */}
      <div className="min-h-0 flex-1 overflow-y-auto py-xs">
        {filteredTree.length === 0 ? (
          <p className="m-0 px-sm py-md text-body-sm text-[var(--app-subtle)]">
            {query ? "No files match your search" : "No files yet"}
          </p>
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedNodeId={selectedNodeId}
              expandedFolderIds={expandedFolderIds}
              query={query}
              onToggleFolder={onToggleFolder}
              onSelectNode={onSelectNode}
            />
          ))
        )}
      </div>
    </div>
  );
}
