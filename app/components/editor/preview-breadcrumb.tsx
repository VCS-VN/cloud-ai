interface PreviewBreadcrumbProps {
  path: string;
  onNavigate?: (path: string) => void;
}

export function PreviewBreadcrumb({
  path,
  onNavigate,
}: PreviewBreadcrumbProps) {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex items-center gap-xxs border-b border-[var(--app-border)] px-md py-xs overflow-x-auto">
      {segments.map((segment, index) => {
        const segmentPath = segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;

        return (
          <div key={segmentPath} className="flex items-center gap-xxs">
            {index > 0 && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0 text-[var(--app-subtle)]"
              >
                <path
                  d="M4.5 2L8.5 6L4.5 10"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {onNavigate && !isLast ? (
              <button
                type="button"
                onClick={() => onNavigate(segmentPath)}
                className="flex-shrink-0 rounded px-xxs py-[1px] text-caption text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
              >
                {segment}
              </button>
            ) : (
              <span className="flex-shrink-0 text-caption text-[var(--app-text)]">
                {segment}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
