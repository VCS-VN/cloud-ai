import type { AgentStreamEvent } from "./agent-events";
import type { SkeletonPhase, SkeletonUpdateEvent } from "@/shared/project-types";
import { sanitizeForUser } from "./user-facing-presenter";

type ServerSkeletonPhase = Exclude<SkeletonPhase, "starting">;

const PHASE_LABELS: Record<ServerSkeletonPhase, string> = {
  understanding: "Understanding your request",
  planning: "Planning your storefront",
  editing: "Updating your storefront",
  installing: "Installing packages",
  starting_preview: "Starting your preview",
  validating: "Checking your storefront",
  repairing: "Fixing an issue",
  responding: "Writing a response",
};

const THROTTLE_MS = 200;

type PhaseResolution = { phase: ServerSkeletonPhase; detail?: string };

/**
 * T045-T046: Per-page skeleton labels for sequential page generation.
 * When the orchestrator emits a "generating_page" event, the skeleton label
 * becomes "Đang thiết kế [Page Name] ([N]/[Total])".
 */
export type PageGenerationProgress = {
  currentPage: string;
  pageIndex: number;
  totalPages: number;
};

export function formatPerPageLabel(progress: PageGenerationProgress): string {
  return `Đang thiết kế ${progress.currentPage} (${progress.pageIndex + 1}/${progress.totalPages})`;
}

function resolvePhase(event: AgentStreamEvent): PhaseResolution | undefined {
  switch (event.type) {
    case "thinking_started":
      return { phase: "understanding" };
    case "plan_created":
      return { phase: "planning" };
    case "source_generation_started":
      return { phase: "editing" };
    case "tool_call_requested": {
      const detail = sanitizeForUser(event.safeSummary ?? "");
      return { phase: "editing", detail: detail || undefined };
    }
    case "dev_install_started":
      return { phase: "installing" };
    case "dev_starting":
      return { phase: "starting_preview" };
    case "validation_started":
      return { phase: "validating" };
    case "repair_started":
    case "dev_fix_attempt":
      return { phase: "repairing" };
    case "assistant_message_delta":
      return { phase: "responding" };
    default:
      return undefined;
  }
}

/**
 * Stateful mapper: AgentStreamEvent -> SkeletonUpdateEvent.
 * Emits immediately when the phase changes; throttles repeated updates within
 * the same phase to one per THROTTLE_MS so rapid tool calls don't spam the stream.
 * Returns undefined when the event is not skeleton-relevant or is throttled.
 *
 * T045-T046: Supports per-page labels via setPageProgress(). When page progress
 * is set, editing-phase updates use "Đang thiết kế [Page] (N/Total)" format.
 */
export function createSkeletonMapper(runId: string) {
  let lastPhase: ServerSkeletonPhase | null = null;
  let lastEmitAt = 0;
  let lastDetail: string | undefined;
  let pageProgress: PageGenerationProgress | null = null;

  function setPageProgress(progress: PageGenerationProgress | null) {
    pageProgress = progress;
  }

  function map(
    event: AgentStreamEvent,
    now: number = Date.now(),
  ): SkeletonUpdateEvent | undefined {
    const resolved = resolvePhase(event);
    if (!resolved) return undefined;

    const phaseChanged = resolved.phase !== lastPhase;
    const detailChanged = resolved.detail !== lastDetail;

    if (!phaseChanged && !detailChanged) return undefined;
    if (!phaseChanged && now - lastEmitAt < THROTTLE_MS) return undefined;

    lastPhase = resolved.phase;
    lastEmitAt = now;
    lastDetail = resolved.detail;

    // T045-T046: Use per-page label when editing with page progress set
    const label =
      resolved.phase === "editing" && pageProgress
        ? formatPerPageLabel(pageProgress)
        : PHASE_LABELS[resolved.phase];

    return {
      type: "skeleton.update",
      runId,
      phase: resolved.phase,
      label,
      detail: resolved.detail,
    };
  }

  return { map, setPageProgress };
}
