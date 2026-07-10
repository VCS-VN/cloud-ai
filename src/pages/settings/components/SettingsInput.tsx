export function SettingsInput({
  label,
  value,
  prefix,
  mono,
}: {
  label: string;
  value: string;
  prefix?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {prefix ? (
        <div className="flex h-10 items-center rounded-lg border border-hairline bg-paper px-3 text-ui-sm font-mono">
          <span className="text-subtle">{prefix}</span>
          <input
            className="ml-1 flex-1 bg-transparent outline-none"
            defaultValue={value}
          />
        </div>
      ) : (
        <input
          className={`h-10 rounded-lg border border-hairline bg-paper px-3 text-ui-sm outline-none focus:border-ink ${mono ? "font-mono" : ""}`}
          defaultValue={value}
        />
      )}
    </label>
  );
}
