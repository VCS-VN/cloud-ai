import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Cpu, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listEpisCloudModels } from "@/server/functions/auth";
import type { EpisCloudModel, EpisCloudModelsResult } from "@/auth/types";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; models: EpisCloudModel[] }
  | { status: "no-api-key" }
  | { status: "error"; message: string };

function labelForModel(model: EpisCloudModel) {
  return model.id;
}

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
  const [state, setState] = useState<LoadState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const result = (await listModels()) as EpisCloudModelsResult;
      if (result.status === "ok") {
        setState({ status: "ok", models: result.models });
      } else if (result.status === "no-api-key") {
        setState({ status: "no-api-key" });
      } else {
        setState({ status: "error", message: result.message });
      }
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not load models. Please try again.",
      });
    }
  }, [listModels]);

  // Load the model list the first time the popover opens.
  useEffect(() => {
    if (open && state.status === "idle") void load();
  }, [open, state.status, load]);

  const triggerLabel = selectedModel ?? "Model";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="unstyled"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className="composer-effort-trigger"
        >
          <Cpu aria-hidden="true" size={12} />
          Model: <span className="text-ink">{triggerLabel}</span>
          <ChevronDown aria-hidden="true" size={10} className="text-subtle" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 p-1">
        {state.status === "loading" || state.status === "idle" ? (
          <div className="flex items-center gap-2 px-3 py-4 text-ui-sm text-muted">
            <Loader2 aria-hidden="true" size={14} className="animate-spin" />
            Loading models…
          </div>
        ) : null}

        {state.status === "no-api-key" ? (
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
        ) : null}

        {state.status === "error" ? (
          <div className="space-y-3 p-3">
            <p className="m-0 text-ui-sm leading-relaxed text-danger-fg">
              {state.message}
            </p>
            <Button
              variant="outline"
              type="button"
              className="!h-9 w-full"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {state.status === "ok" ? (
          state.models.length === 0 ? (
            <p className="m-0 px-3 py-4 text-ui-sm text-muted">
              No models available on your account yet.
            </p>
          ) : (
            <div role="listbox" className="max-h-64 overflow-y-auto">
              {state.models.map((model) => {
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
                        {labelForModel(model)}
                      </span>
                      {model.ownedBy ? (
                        <span className="block truncate text-eyebrow text-muted">
                          {model.ownedBy}
                        </span>
                      ) : null}
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
