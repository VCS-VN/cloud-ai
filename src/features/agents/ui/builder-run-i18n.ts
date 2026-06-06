import type {
  BuilderRunFailureCode,
  BuilderRunMilestone,
} from "@/features/agents/ui/builder-events";

export const BUILDER_RUN_LOCALE_VI = {
  milestones: {
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
  } as Record<BuilderRunMilestone, string>,
  failures: {
    validation_failed: "Bản dựng không qua kiểm tra. Vui lòng thử lại.",
    boundary_violation: "Yêu cầu nằm ngoài phạm vi cho phép.",
    config_unavailable:
      "Trình tạo AI hiện tạm thời không khả dụng. Vui lòng liên hệ quản trị viên hoặc thử lại sau.",
    cancelled: "Bạn đã huỷ phiên này. Không có thay đổi nào được xuất bản.",
    preview_failed: "Preview chưa lên được, không xuất bản.",
    codex_runtime_failed: "Trình tạo AI gặp lỗi tạm thời.",
    blocked_request: "Yêu cầu chạm vào tệp được bảo vệ.",
    repair_exhausted: "Đã thử sửa lỗi tối đa và vẫn chưa pass.",
  } as Record<BuilderRunFailureCode, string>,
  commerceValidationSkippedWarning:
    "Việc xác thực luồng giỏ/thanh toán chưa được thực hiện đầy đủ ở phase 1.",
};

export const BUILDER_RUN_LOCALE_EN = {
  milestones: {
    loading_context: "Loading project context",
    planning: "Planning",
    creating_draft: "Creating draft",
    building_pages: "Building pages",
    checking_preview: "Checking preview",
    repairing: "Repairing",
    publishing: "Publishing",
    done: "Done",
    failed: "Failed",
    cancelled: "Cancelled",
  } as Record<BuilderRunMilestone, string>,
  failures: {
    validation_failed: "Validation failed. Please try again.",
    boundary_violation: "Request reached outside the allowed scope.",
    config_unavailable:
      "AI builder is temporarily unavailable. Please contact an administrator or try again later.",
    cancelled: "You cancelled this run. No changes were published.",
    preview_failed: "Preview did not come up; nothing was published.",
    codex_runtime_failed: "The AI builder hit a transient error.",
    blocked_request: "The request touched a protected file.",
    repair_exhausted:
      "Repair was attempted the maximum number of times and still failed.",
  } as Record<BuilderRunFailureCode, string>,
  commerceValidationSkippedWarning:
    "Cart and checkout flows were not fully validated in phase 1.",
};
