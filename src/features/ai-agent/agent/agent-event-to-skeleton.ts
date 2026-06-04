import type { AgentStreamEvent } from "./agent-events";
import type { SkeletonPhase, SkeletonUpdateEvent } from "@/shared/project-types";
import {
  phaseStepLabel,
  sanitizeForUser,
  type UserLanguage,
} from "./user-facing-presenter";

type ServerSkeletonPhase = Exclude<SkeletonPhase, "starting">;

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

function resolvePhase(
  event: AgentStreamEvent,
  language: UserLanguage,
): PhaseResolution | undefined {
  switch (event.type) {
    case "thinking_started":
      return { phase: "understanding" };
    case "plan_created":
      return { phase: "planning" };
    case "source_generation_started": {
      const detail = sanitizeForUser(event.message ?? "");
      return { phase: "editing", detail: detail || undefined };
    }
    case "tool_call_requested": {
      const detail = sanitizeForUser(event.safeSummary ?? "");
      return { phase: "editing", detail: detail || undefined };
    }
    case "tool_progress": {
      const detail = sanitizeForUser(resolveToolProgressDetail(event, language));
      return {
        phase: event.status === "failed" ? "repairing" : resolveToolPhase(event.toolName),
        detail: detail || undefined,
      };
    }
    case "dev_install_started":
      return { phase: "installing", detail: stepText(language, "Đang chuẩn bị môi trường storefront", "Preparing the storefront runtime") };
    case "dev_install_completed":
      return { phase: "installing", detail: stepText(language, "Dependency đã sẵn sàng", "Packages are ready") };
    case "dev_install_failed":
      return { phase: "repairing", detail: stepText(language, "Cần sửa bước chuẩn bị dependency", "Package setup needs a quick fix") };
    case "dev_starting":
      return { phase: "starting_preview", detail: stepText(language, "Đang mở server preview", "Opening the preview server") };
    case "dev_ready":
      return { phase: "starting_preview", detail: stepText(language, "Preview đã sẵn sàng", "Preview is ready") };
    case "dev_error":
      return { phase: "repairing", detail: stepText(language, "Preview phát hiện lỗi cần sửa", "Preview found an issue") };
    case "validation_started":
      return { phase: "validating", detail: stepText(language, "Đang chạy kiểm tra", "Running checks") };
    case "validation_finished":
      const validationPassed =
        "status" in event ? event.status === "passed" : event.ok === true;
      return {
        phase: validationPassed ? "validating" : "repairing",
        detail:
          validationPassed
            ? stepText(language, "Kiểm tra đã pass", "Checks passed")
            : stepText(language, "Đang xem kết quả kiểm tra", "Reviewing check results"),
      };
    case "repair_started":
      return {
        phase: "repairing",
        detail: stepText(language, `Đang sửa lỗi lần ${event.attempt}`, `Repair attempt ${event.attempt}`),
      };
    case "dev_fix_attempt":
      return {
        phase: "repairing",
        detail: stepText(language, `Đang sửa preview lần ${event.attempt}`, `Fix attempt ${event.attempt}`),
      };
    case "dev_fix_applied":
      return { phase: "repairing", detail: stepText(language, "Đã áp dụng bản sửa", "Applied a fix") };
    case "dev_fix_failed":
      return { phase: "repairing", detail: stepText(language, "Cần thêm một lượt sửa", "Fix needs another pass") };
    case "assistant_message_delta":
      return { phase: "responding" };
    default:
      return undefined;
  }
}

function resolveToolPhase(toolName: string): ServerSkeletonPhase {
  if (/validation|check/i.test(toolName)) return "validating";
  if (/install|package/i.test(toolName)) return "installing";
  return "editing";
}

function resolveToolProgressDetail(
  event: Extract<AgentStreamEvent, { type: "tool_progress" }>,
  language: UserLanguage,
) {
  if (event.status === "running") {
    return stepText(language, "Đang thực hiện bước này", "Working through this step");
  }
  if (event.status === "completed") {
    return stepText(language, "Bước này đã xong", "Step completed");
  }
  return stepText(language, "Bước này cần thử lại", "Step needs another try");
}

function stepText(language: UserLanguage, vi: string, en: string) {
  return language === "vi" ? vi : en;
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
export function createSkeletonMapper(runId: string, language: UserLanguage = "en") {
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
    const resolved = resolvePhase(event, language);
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
        : phaseStepLabel(resolved.phase, language);

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
