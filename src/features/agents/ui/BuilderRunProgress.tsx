import type { BuilderRunFailureCode, BuilderRunMilestone } from "@/features/agents/ui/builder-events";
import { useBuilderRunStream } from "./use-builder-run-stream";

const MILESTONE_LABEL_VI: Record<BuilderRunMilestone, string> = {
  loading_context: "Đang nạp ngữ cảnh dự án",
  planning: "Đang lập kế hoạch",
  creating_draft: "Đang tạo bản nháp",
  building_pages: "Đang dựng các trang",
  checking_preview: "Đang kiểm tra preview",
  repairing: "Đang sửa lỗi",
  publishing: "Đang xuất bản",
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
};

export type BuilderRunProgressProps = {
  projectId: string;
  runId: string | null;
  onCancel?: (runId: string) => void | Promise<void>;
};

export function BuilderRunProgress({ projectId, runId, onCancel }: BuilderRunProgressProps) {
  const state = useBuilderRunStream({ projectId, runId });

  if (!runId) return null;
  const label = state.milestone ? MILESTONE_LABEL_VI[state.milestone] : "Đang khởi động…";
  const failureLabel = state.failureCode ? FAILURE_LABEL_VI[state.failureCode] : null;
  const cancelMessage = state.milestone === "cancelled" ? "Không có thay đổi nào được xuất bản." : null;

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
    </div>
  );
}
