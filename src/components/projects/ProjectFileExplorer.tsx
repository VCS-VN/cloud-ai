import { Search } from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingState } from "../common/LoadingState";
import type { ProjectFileNode } from "@/shared/project-types";
import { ProjectFileTreeNode } from "./ProjectFileTreeNode";

type ProjectFileExplorerProps = {
  fileTree: ProjectFileNode[];
  selectedNodeId?: string;
  loading?: boolean;
  error?: string;
  expandedFolderIds?: Set<string>;
  query?: string;
  variant?: "default" | "code";
  onQueryChange?: (query: string) => void;
  onToggleFolder?: (node: ProjectFileNode) => void;
  onSelectNode: (node: ProjectFileNode) => void;
};

export function ProjectFileExplorer({
  fileTree,
  selectedNodeId,
  loading = false,
  error,
  expandedFolderIds,
  query = "",
  variant = "default",
  onQueryChange,
  onToggleFolder,
  onSelectNode,
}: ProjectFileExplorerProps) {
  if (loading) return <LoadingState label="Loading structure..." />;
  if (error)
    return <ErrorState title="Unable to load structure" message={error} />;
  if (fileTree.length === 0) {
    return (
      <EmptyState
        title="No structure yet"
        description="Generated pages and files will appear here."
      />
    );
  }

  const isCode = variant === "code";

  return (
    <section
      className={`min-w-0 h-132! rounded-md p-sm ${isCode ? "border-[var(--color-hairline)] bg-[var(--app-panel-bg)] text-[var(--app-panel-text)]" : "border-[var(--color-hairline)] bg-[var(--app-panel-bg)] text-[var(--app-panel-text)]"}`}
      aria-label="Project file explorer"
    >
      <div className="mb-sm flex items-center justify-between gap-sm px-xs">
        <h2 className="m-0 text-[14px] font-[520] leading-tight tracking-[-0.015em]">
          {isCode ? "Files" : "Structure"}
        </h2>
        {!isCode ? (
          <span className="rounded-pill bg-[var(--app-control)] px-sm py-xxs font-mono text-caption uppercase tracking-[0.12em] text-[var(--app-muted-text)]">
            Virtual
          </span>
        ) : null}
      </div>
      {isCode ? (
        <label className="mb-sm flex h-9 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-muted-text)] [&_svg]:text-[var(--app-icon-muted)]">
          <Search aria-hidden="true" size={15} />
          <span className="sr-only">Search code</span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[var(--app-panel-text)] outline-none placeholder:text-[var(--app-subtle-text)]"
            value={query}
            placeholder="Search code"
            onChange={(event) => onQueryChange?.(event.target.value)}
          />
        </label>
      ) : null}
      <ul className="m-0 flex flex-col gap-xxs p-0">
        {fileTree.map((node) => (
          <ProjectFileTreeNode
            key={node.id}
            node={node}
            selectedNodeId={selectedNodeId}
            expandedFolderIds={expandedFolderIds}
            depth={0}
            variant={variant}
            query={query}
            onToggleFolder={onToggleFolder}
            onSelectNode={onSelectNode}
          />
        ))}
      </ul>
    </section>
  );
}
