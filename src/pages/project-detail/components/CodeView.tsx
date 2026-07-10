import { Copy, Download, MessageSquarePlus } from "lucide-react";
import { ProjectFileExplorer } from "@/components/projects/ProjectFileExplorer";
import { Button } from "@/components/ui/button";
import type { ProjectFileNode } from "@/shared/project-types";

export function CodeView({
  fileTree,
  selectedNode,
  selectedNodeId,
  query,
  expandedFolderIds,
  onQueryChange,
  onToggleFolder,
  onSelectNode,
}: {
  fileTree: ProjectFileNode[];
  selectedNode?: ProjectFileNode;
  selectedNodeId?: string;
  query: string;
  expandedFolderIds: Set<string>;
  onQueryChange: (query: string) => void;
  onToggleFolder: (node: ProjectFileNode) => void;
  onSelectNode: (node: ProjectFileNode) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="min-h-0 overflow-auto border-r bg-[rgb(var(--color-surface))] p-2 transition-colors duration-300">
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
      <CodeContentPanel node={selectedNode} />
    </div>
  );
}

function CodeContentPanel({ node }: { node?: ProjectFileNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgb(var(--color-surface))] transition-colors duration-300">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2 transition-colors duration-300">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate rounded-t-md bg-[rgb(var(--color-surface))] px-2 py-1 text-[12px] font-[520]">
            {node?.path ?? "Select a file"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[rgb(var(--color-muted))]">
          <span>Read only</span>
          <Button
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2"
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" size={14} />
          </Button>
          <Button
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2"
            type="button"
          >
            <Copy aria-hidden="true" size={14} />
          </Button>
          <Button
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2"
            type="button"
          >
            <Download aria-hidden="true" size={14} />
            Download
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
        {node?.content ? (
          node.contentType?.startsWith("image/") ? (
            <div className="flex min-h-full items-center justify-center bg-[rgb(var(--color-chalk))] p-4">
              <pre className="whitespace-pre-wrap break-words text-[12px] text-[rgb(var(--color-ink))]">
                {node.content}
              </pre>
            </div>
          ) : (
            <pre className="builder-truncate-safe min-w-0 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[rgb(var(--color-chalk))] p-2 font-mono text-[12px] leading-4 text-[rgb(var(--color-ink))] transition-colors duration-300 [overflow-wrap:anywhere]">
              {node.content}
            </pre>
          )
        ) : (
          <p className="m-0 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] p-2 text-[12px] leading-4 text-[rgb(var(--color-muted))] transition-colors duration-300">
            Select a file to inspect its content. Folders expand in the file
            tree and do not show content here.
          </p>
        )}
      </div>
    </section>
  );
}
