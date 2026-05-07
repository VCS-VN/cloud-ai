import type { ProjectFileNode } from "@/shared/project-types";
import { ProjectFileExplorer } from "./project-file-explorer";
import { CodeContentPanel } from "./code-content-panel";

interface CodeViewProps {
  fileTree: ProjectFileNode[];
  selectedNode?: ProjectFileNode;
  selectedNodeId?: string;
  query: string;
  expandedFolderIds: Set<string>;
  onQueryChange: (query: string) => void;
  onToggleFolder: (node: ProjectFileNode) => void;
  onSelectNode: (node: ProjectFileNode) => void;
}

export function CodeView({
  fileTree,
  selectedNode,
  selectedNodeId,
  query,
  expandedFolderIds,
  onQueryChange,
  onToggleFolder,
  onSelectNode,
}: CodeViewProps) {
  return (
    <div className="grid min-h-0 min-w-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* Left: File explorer */}
      <div className="min-h-0 overflow-auto border-r border-[var(--app-border)] bg-[var(--app-panel)] transition-colors duration-300">
        <ProjectFileExplorer
          fileTree={fileTree}
          selectedNodeId={selectedNodeId}
          expandedFolderIds={expandedFolderIds}
          query={query}
          variant="code"
          onQueryChange={onQueryChange}
          onToggleFolder={onToggleFolder}
          onSelectNode={onSelectNode}
        />
      </div>

      {/* Right: Code content */}
      <CodeContentPanel node={selectedNode} />
    </div>
  );
}
