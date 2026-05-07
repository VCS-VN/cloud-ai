interface PreviewToolbarProps {
  onCodeView?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onRefresh?: () => void;
  onStop?: () => void;
  onPlay?: () => void;
  onSettings?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isPlaying?: boolean;
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  active,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 ${
        active
          ? "bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]"
          : "text-[var(--app-icon-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-icon)]"
      } ${disabled ? "pointer-events-none opacity-30" : "cursor-pointer"}`}
      aria-label={title}
    >
      {children}
    </button>
  );
}

export function PreviewToolbar({
  onCodeView,
  onUndo,
  onRedo,
  onRefresh,
  onStop,
  onPlay,
  onSettings,
  canUndo = false,
  canRedo = false,
  isPlaying = false,
}: PreviewToolbarProps) {
  return (
    <div className="flex-shrink-0 flex items-center gap-xxs border-b border-[var(--app-border)] px-md py-xs">
      {/* Code view toggle */}
      <ToolbarButton onClick={onCodeView} title="View code">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 4L2 8L5.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 4L14 8L10.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 3L6.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <div className="mx-xxs h-4 w-[1px] bg-[var(--app-border)]" />

      {/* Undo */}
      <ToolbarButton onClick={onUndo} disabled={!canUndo} title="Undo">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6H10C12.2091 6 14 7.79086 14 10C14 12.2091 12.2091 14 10 14H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 3L3 6L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>

      {/* Redo */}
      <ToolbarButton onClick={onRedo} disabled={!canRedo} title="Redo">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 6H6C3.79086 6 2 7.79086 2 10C2 12.2091 3.79086 14 6 14H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 3L13 6L10 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>

      <div className="mx-xxs h-4 w-[1px] bg-[var(--app-border)]" />

      {/* Refresh */}
      <ToolbarButton onClick={onRefresh} title="Refresh">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.5 8C13.5 11.0376 11.0376 13.5 8 13.5C4.96243 13.5 2.5 11.0376 2.5 8C2.5 4.96243 4.96243 2.5 8 2.5C9.86564 2.5 11.5093 3.42453 12.5 4.83972" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 4.5H13V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>

      {/* Stop */}
      <ToolbarButton onClick={onStop} title="Stop">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
        </svg>
      </ToolbarButton>

      {/* Play */}
      <ToolbarButton onClick={onPlay} active={isPlaying} title="Run/Play">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.5 3L12.5 8L4.5 13V3Z" fill="currentColor" />
        </svg>
      </ToolbarButton>

      <div className="flex-1" />

      {/* Settings */}
      <ToolbarButton onClick={onSettings} title="Settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.5V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 12.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M2.5 5.5L4.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11.5 9.5L13.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M2.5 10.5L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11.5 6.5L13.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
