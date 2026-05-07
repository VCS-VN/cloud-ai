import type { ProjectFileNode } from "@/shared/project-types";

interface FileTreeGridProps {
  nodes: ProjectFileNode[];
  currentPath: string;
  onSelectFolder: (path: string) => void;
  onSelectFile: (node: ProjectFileNode) => void;
  onNavigateParent?: () => void;
}

function FolderIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 10C4 8.89543 4.89543 8 6 8H15L19 12H34C35.1046 12 36 12.8954 36 14V30C36 31.1046 35.1046 32 34 32H6C4.89543 32 4 31.1046 4 30V10Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M4 10C4 8.89543 4.89543 8 6 8H15L19 12H34C35.1046 12 36 12.8954 36 14V16H4V10Z"
        fill="currentColor"
        opacity="0.32"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 8H24L30 14V32H10V8Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M24 8V14H30"
        fill="currentColor"
        opacity="0.32"
      />
    </svg>
  );
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const isCode = ["ts", "tsx", "js", "jsx", "css", "scss", "html", "json", "md"].includes(ext ?? "");
  return isCode ? (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 8H24L30 14V32H10V8Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M24 8V14H30"
        fill="currentColor"
        opacity="0.32"
      />
      <text x="20" y="26" textAnchor="middle" fontSize="8" fontWeight="600" fill="currentColor" fontFamily="figmaMono, monospace">
        {ext?.toUpperCase().slice(0, 4)}
      </text>
    </svg>
  ) : (
    <FileIcon />
  );
}

export function FileTreeGrid({
  nodes,
  currentPath,
  onSelectFolder,
  onSelectFile,
  onNavigateParent,
}: FileTreeGridProps) {
  // Sort: folders first, then files, both alphabetically
  const sorted = [...nodes].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  const segments = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-md">
      {/* Parent folder navigation */}
      {onNavigateParent && segments.length > 0 && (
        <button
          type="button"
          onClick={onNavigateParent}
          className="mb-md flex w-fit items-center gap-xs rounded-md px-sm py-xs text-body-sm text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ..
        </button>
      )}

      {/* File/folder grid — wraps to next line */}
      <div className="flex flex-wrap gap-md">
        {sorted.length === 0 && (
          <p className="m-0 py-lg text-body-sm text-[var(--app-subtle)]">
            This folder is empty
          </p>
        )}
        {sorted.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => {
              if (node.type === "folder") {
                onSelectFolder(node.path);
              } else {
                onSelectFile(node);
              }
            }}
            className="flex w-20 flex-col items-center gap-xs rounded-md px-xs py-sm text-body-sm text-[var(--app-icon-muted)] transition-colors duration-150 hover:bg-[var(--app-surface)] hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            title={node.name}
          >
            <div className="flex h-12 w-12 items-center justify-center transition-colors">
              {node.type === "folder" ? <FolderIcon /> : getFileIcon(node.name)}
            </div>
            <span className="max-w-full truncate text-center text-caption leading-tight">
              {node.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
