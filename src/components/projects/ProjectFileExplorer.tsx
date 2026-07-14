import { Search } from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingState } from "../common/LoadingState";
import { Input } from "@/components/ui/input";
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
      className="min-w-0 h-full rounded-md p-2 text-ink"
      aria-label="Project file explorer"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="m-0 text-[14px] font-semibold leading-tight tracking-[-0.015em]">
          {isCode ? "Files" : "Structure"}
        </h2>
        {!isCode ? (
          <span className="rounded-pill bg-chalk px-2 py-0.5 font-mono text-caption uppercase tracking-[0.12em] text-muted">
            Virtual
          </span>
        ) : null}
      </div>
      {isCode ? (
        <label className="mb-2 flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-chalk px-2 text-[12px] text-muted [&_svg]:text-subtle">
          <Search aria-hidden="true" size={15} />
          <span className="sr-only">Search code</span>
          <Input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-ink outline-none placeholder:text-subtle"
            value={query}
            placeholder="Search code"
            onChange={(event) => onQueryChange?.(event.target.value)}
          />
        </label>
      ) : null}
      <ul className="m-0 flex flex-col gap-0.5 p-0">
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
