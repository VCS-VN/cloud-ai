import { BUILDER_RUN_LOCALE_VI } from "./builder-run-i18n";

export type BuilderUnavailableBannerProps = {
  message?: string;
};

export function BuilderUnavailableBanner(props: BuilderUnavailableBannerProps) {
  const message = props.message ?? BUILDER_RUN_LOCALE_VI.failures.config_unavailable;
  return (
    <div
      role="status"
      data-testid="builder-unavailable-banner"
      className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

export type BuilderPromptInputProps = {
  available: boolean;
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  inlineError?: string | null;
};

export function BuilderPromptInput(props: BuilderPromptInputProps) {
  const placeholder =
    props.placeholder ??
    (props.available
      ? "Mô tả thay đổi bạn muốn áp dụng cho dự án..."
      : BUILDER_RUN_LOCALE_VI.failures.config_unavailable);
  return (
    <div className="flex flex-col gap-1">
      <textarea
        className="min-h-[3rem] w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        disabled={!props.available}
        value={props.value}
        placeholder={placeholder}
        onChange={(e) => props.onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (props.available && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            props.onSubmit?.();
          }
        }}
      />
      {props.inlineError ? (
        <p
          role="alert"
          data-testid="builder-prompt-inline-error"
          className="text-xs text-destructive"
        >
          {props.inlineError}
        </p>
      ) : null}
    </div>
  );
}
