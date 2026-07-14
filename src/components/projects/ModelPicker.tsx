import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Cpu, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listEpisCloudModels } from "@/server/functions/auth";
import type { EpisCloudModelsResult } from "@/auth/types";

export function ModelPicker({
  selectedModel,
  disabled = false,
  onModelChange,
}: {
  selectedModel: string | null;
  disabled?: boolean;
  onModelChange: (modelId: string) => void;
}) {
  const listModels = useServerFn(listEpisCloudModels);
  const [open, setOpen] = useState(false);

  // useQuery fully owns the models data plus its loading/error state. The
  // server fn returns a discriminated result (ok / no-api-key / error), so
  // those are query data; a thrown request failure surfaces via query.error.
  const query = useQuery({
    queryKey: ["episcloud-models"],
    queryFn: () => listModels() as Promise<EpisCloudModelsResult>,
    // enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const models = query.data?.status === "ok" ? query.data.models : [];
  const selectedName = models.find((m) => m.id === selectedModel)?.name;
  const triggerLabel = selectedName ?? selectedModel ?? "Model";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="unstyled"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          title={triggerLabel}
          className="composer-effort-trigger min-w-0 max-w-[180px]"
        >
          <Cpu aria-hidden="true" size={12} className="shrink-0" />
          <span className="truncate text-ink">{triggerLabel}</span>
          <ChevronDown
            aria-hidden="true"
            size={10}
            className="shrink-0 text-subtle"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 p-1">
        {query.isPending || query.isFetching ? (
          <div className="flex items-center gap-2 px-3 py-4 text-ui-sm text-muted">
            <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            Loading models…
          </div>
        ) : query.isError ? (
          <div className="space-y-3 p-3">
            <p className="m-0 text-ui-sm leading-relaxed text-danger-fg">
              {query.error instanceof Error
                ? query.error.message
                : "Could not load models. Please try again."}
            </p>
            <Button
              variant="outline"
              type="button"
              className="!h-9 w-full"
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : query.data?.status === "no-api-key" ? (
          <div className="space-y-3 p-3">
            <div className="flex items-start gap-2">
              <Sparkles
                aria-hidden="true"
                size={16}
                className="mt-0.5 shrink-0 text-subtle"
              />
              <p className="m-0 text-ui-sm leading-relaxed text-muted">
                Activate EpisCloud to load the available AI models for your
                account.
              </p>
            </div>
            <Link
              to="/settings"
              hash="profile"
              onClick={() => setOpen(false)}
              className="flex h-9 w-full items-center justify-center rounded-md bg-ink px-3 text-ui-sm font-semibold text-paper transition-colors hover:bg-deep"
            >
              Activate EpisCloud
            </Link>
          </div>
        ) : query.data?.status === "error" ? (
          <div className="space-y-3 p-3">
            <p className="m-0 text-ui-sm leading-relaxed text-danger-fg">
              {query.data.message}
            </p>
            <Button
              variant="outline"
              type="button"
              className="!h-9 w-full"
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : query.data?.status === "ok" ? (
          query.data.models.length === 0 ? (
            <p className="m-0 px-3 py-4 text-ui-sm text-muted">
              No models available on your account yet.
            </p>
          ) : (
            <div role="listbox" className="max-h-64 overflow-y-auto">
              {query.data.models.map((model) => {
                const active = model.id === selectedModel;
                return (
                  <Button
                    key={model.id}
                    variant="unstyled"
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className={`composer-effort-option ${active ? "composer-effort-option-active" : ""}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-ui-sm font-medium text-ink">
                        {model.name}
                      </span>
                      {/* {model.ownedBy ? (
                        <span className="block truncate text-eyebrow text-muted">
                          {model.ownedBy}
                        </span>
                      ) : null} */}
                    </span>
                    {active ? (
                      <Check
                        aria-hidden="true"
                        size={12}
                        className="shrink-0 text-success-fg"
                      />
                    ) : null}
                  </Button>
                );
              })}
            </div>
          )
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
