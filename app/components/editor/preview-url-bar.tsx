interface PreviewUrlBarProps {
  url?: string;
  onRefresh?: () => void;
}

export function PreviewUrlBar({ url = "http://localhost:5174", onRefresh }: PreviewUrlBarProps) {
  return (
    <div className="flex-shrink-0 flex items-center gap-xs border-b border-[var(--app-border)] px-md py-xs">
      {/* Lock icon */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-[var(--app-subtle)]">
        <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 6V4C5 2.89543 5.89543 2 7 2C8.10457 2 9 2.89543 9 4V6" stroke="currentColor" strokeWidth="1.2" />
      </svg>

      {/* URL input */}
      <input
        type="text"
        value={url}
        readOnly
        className="flex-1 rounded-md border border-transparent bg-[var(--app-surface)] px-sm py-xs text-body-sm text-[var(--app-text)] outline-none transition-colors duration-150 hover:border-[var(--app-border)] focus:border-[var(--app-border)] focus:bg-[var(--app-control)]"
        aria-label="Preview URL"
      />

      {/* Refresh */}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Reload preview"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--app-icon-muted)] transition-colors duration-150 hover:bg-[var(--app-surface)] hover:text-[var(--app-icon)]"
          aria-label="Reload preview"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 7C12 9.76142 9.76142 12 7 12C4.23858 12 2 9.76142 2 7C2 4.23858 4.23858 2 7 2C8.64625 2 10.1043 2.79582 11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M9 3.5H11.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
