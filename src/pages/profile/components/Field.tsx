import type { UserRound } from "lucide-react";

export function Field({
  label,
  htmlFor,
  icon: Icon,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-ui-sm font-medium text-ink"
      >
        {Icon ? <Icon aria-hidden="true" className="h-4 w-4 text-muted" /> : null}
        {label}
      </label>
      {children}
    </div>
  );
}
