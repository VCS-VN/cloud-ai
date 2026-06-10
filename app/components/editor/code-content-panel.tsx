import type { ProjectFileNode } from "@/shared/project-types";

interface CodeContentPanelProps {
  node?: ProjectFileNode;
}

export function CodeContentPanel({ node }: CodeContentPanelProps) {
  if (!node) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center text-center">
        <div className="flex flex-col items-center gap-xs">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[var(--app-icon-muted)]"
          >
            <path
              d="M12 8H28L36 16V40H12V8Z"
              fill="currentColor"
              opacity="0.12"
            />
            <path d="M28 8V16H36" fill="currentColor" opacity="0.24" />
          </svg>
          <p className="m-0 text-body-sm text-[var(--app-muted)]">
            Select a file to view its contents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* File name bar */}
      <div className="flex-shrink-0 flex items-center gap-xs border-b border-[var(--app-border)] px-md py-xs">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 text-[var(--app-icon-muted)]"
        >
          <path d="M3 2H8L11 5V12H3V2Z" fill="currentColor" opacity="0.18" />
          <path d="M8 2V5H11" fill="currentColor" opacity="0.32" />
        </svg>
        <span className="text-body-sm text-[var(--app-text)]">{node.name}</span>
        {node.contentType && (
          <span className="ml-auto rounded-md bg-[var(--app-surface)] px-xs py-[1px] text-caption text-[var(--app-muted)]">
            {node.contentType}
          </span>
        )}
      </div>

      {/* Code content */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {node.content ? (
          <pre className="m-0 font-mono text-body-sm leading-relaxed text-[var(--app-text)] whitespace-pre-wrap">
            {node.content}
          </pre>
        ) : (
          <p className="m-0 font-mono text-body-sm text-[var(--app-subtle)] italic">
            No content available
          </p>
        )}
      </div>
    </div>
  );
}
