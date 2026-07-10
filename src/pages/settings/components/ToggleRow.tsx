export function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <div className="text-ui-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        data-on={enabled ? "true" : "false"}
        className="switch-track"
      >
        <span
          aria-hidden="true"
          data-on={enabled ? "true" : "false"}
          className="switch-thumb"
        />
      </button>
    </li>
  );
}
