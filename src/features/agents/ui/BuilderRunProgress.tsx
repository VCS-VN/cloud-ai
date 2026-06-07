import { useEffect, useState } from "react";
import type { BuilderRunFailureCode, BuilderRunMilestone } from "@/features/agents/ui/builder-events";
import { BUILDER_RUN_LOCALE_VI } from "@/features/agents/ui/builder-run-i18n";
import { useBuilderRunStream } from "./use-builder-run-stream";

const MILESTONE_LABEL_VI: Record<BuilderRunMilestone, string> = {
  loading_context: "Đang nạp ngữ cảnh dự án",
  planning: "Đang lập kế hoạch",
  creating_draft: "Đang tạo bản nháp",
  building_pages: "Đang dựng các trang",
  checking_preview: "Đang kiểm tra preview",
  repairing: "Đang sửa lỗi",
  publishing: "Đang xuất bản",
  awaiting_clarification: "Cần thêm thông tin từ bạn",
  done: "Hoàn tất",
  failed: "Thất bại",
  cancelled: "Đã huỷ",
};

const FAILURE_LABEL_VI: Record<BuilderRunFailureCode, string> = {
  validation_failed: "Bản dựng không qua kiểm tra. Vui lòng thử lại.",
  boundary_violation: "Yêu cầu nằm ngoài phạm vi cho phép.",
  config_unavailable: "Trình tạo AI hiện chưa sẵn sàng.",
  cancelled: "Bạn đã huỷ phiên này. Không có thay đổi nào được xuất bản.",
  preview_failed: "Preview chưa lên được, không xuất bản.",
  codex_runtime_failed: "Trình tạo AI gặp lỗi tạm thời.",
  blocked_request: "Yêu cầu chạm vào tệp được bảo vệ.",
  repair_exhausted: "Đã thử sửa lỗi tối đa và vẫn chưa pass.",
  required_skill_unavailable: "Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent.",
  skill_unavailable: "Skill được yêu cầu hiện chưa có sẵn.",
};

const GENERIC_API_ERROR_VI = "Không thể gửi câu trả lời. Vui lòng thử lại.";

function mapApiErrorMessage(code: string | undefined): string {
  if (!code) return GENERIC_API_ERROR_VI;
  const messages = BUILDER_RUN_LOCALE_VI.apiErrors as Record<string, string>;
  return messages[code] ?? GENERIC_API_ERROR_VI;
}

export type BuilderRunProgressProps = {
  projectId: string;
  runId: string | null;
  onCancel?: (runId: string) => void | Promise<void>;
};

export function BuilderRunProgress({ projectId, runId, onCancel }: BuilderRunProgressProps) {
  const state = useBuilderRunStream({ projectId, runId });
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isClarifying = state.milestone === "awaiting_clarification";

  useEffect(() => {
    if (!isClarifying) {
      setSelectedOptionId(null);
      setFreeText("");
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [isClarifying, state.clarificationQuestion]);

  if (!runId) return null;
  const label = state.milestone ? MILESTONE_LABEL_VI[state.milestone] : "Đang khởi động…";
  const failureLabel = state.failureCode ? FAILURE_LABEL_VI[state.failureCode] : null;
  const cancelMessage = state.milestone === "cancelled" ? "Không có thay đổi nào được xuất bản." : null;

  const trimmedFreeText = freeText.trim();
  const hasAnswer = selectedOptionId !== null || trimmedFreeText.length > 0;
  const submitDisabled = !hasAnswer || submitting;

  const handleSubmitAnswer = async () => {
    if (submitDisabled) return;
    setSubmitting(true);
    setSubmitError(null);
    const body: { optionId?: string; freeText?: string } = {};
    if (selectedOptionId !== null) body.optionId = selectedOptionId;
    else if (trimmedFreeText.length > 0) body.freeText = trimmedFreeText;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/builder-runs/${runId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      let payload: { ok?: boolean; code?: string; message?: string } | null = null;
      try {
        payload = (await response.json()) as { ok?: boolean; code?: string; message?: string };
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok !== true) {
        setSubmitError(mapApiErrorMessage(payload?.code));
        setSubmitting(false);
        return;
      }
      // Keep buttons disabled; SSE will deliver the next milestone and reset local state.
    } catch {
      setSubmitError(GENERIC_API_ERROR_VI);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {state.closed ? (
          <span className="text-xs text-muted-foreground">Đã kết thúc</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Đang chạy…</span>
            {onCancel ? (
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => onCancel(runId)}
              >
                Huỷ
              </button>
            ) : null}
          </div>
        )}
      </div>
      {failureLabel ? <p className="text-xs text-destructive">{failureLabel}</p> : null}
      {cancelMessage ? (
        <p className="text-xs text-muted-foreground">{cancelMessage}</p>
      ) : null}
      {isClarifying ? (
        <div className="mt-1 flex flex-col gap-3 rounded border border-border bg-background p-3">
          <p className="text-sm font-medium">
            {state.clarificationQuestion ?? BUILDER_RUN_LOCALE_VI.clarification.questionScaffold}
          </p>
          {state.clarificationOptions && state.clarificationOptions.length > 0 ? (
            <div className="flex flex-col gap-1">
              {state.clarificationOptions.map((option) => {
                const active = selectedOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    disabled={submitting}
                    onClick={() => {
                      setSelectedOptionId(active ? null : option.id);
                      setFreeText("");
                      setSubmitError(null);
                    }}
                    className={`rounded border px-2 py-1 text-left text-xs hover:bg-muted ${
                      active ? "border-primary bg-muted" : "border-border"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">
              {BUILDER_RUN_LOCALE_VI.clarification.freeTextLabel}
            </span>
            <textarea
              value={freeText}
              disabled={submitting}
              onChange={(event) => {
                setFreeText(event.target.value);
                if (event.target.value.trim().length > 0) {
                  setSelectedOptionId(null);
                }
                setSubmitError(null);
              }}
              rows={3}
              className="resize-y rounded border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          {submitError ? (
            <p role="alert" className="text-xs text-destructive">
              {submitError}
            </p>
          ) : null}
          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={submitDisabled}
              onClick={handleSubmitAnswer}
              className="rounded border border-border bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {BUILDER_RUN_LOCALE_VI.clarification.submitButton}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
