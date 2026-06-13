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
    awaiting_clarification: "Cần thêm thông tin từ bạn",
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
    required_skill_unavailable:
      "Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent.",
    skill_unavailable: "Skill được yêu cầu hiện chưa có sẵn.",
    provider_gateway_soft_error:
      "Nhà cung cấp AI đang lỗi tạm thời hoặc quá tải. Hãy thử chạy lại sau ít phút.",
  } as Record<BuilderRunFailureCode, string>,
  clarification: {
    questionScaffold: "Bạn muốn ưu tiên hướng tiếp cận nào cho yêu cầu này?",
    submitButton: "Tiếp tục",
    cancelHint: "Hoặc bấm Huỷ để dừng phiên.",
    freeTextLabel: "Hoặc mô tả ngắn gọn lựa chọn của bạn",
  },
  apiErrors: {
    not_paused: "Phiên không đang chờ phản hồi.",
    empty_answer: "Vui lòng chọn một phương án hoặc nhập câu trả lời.",
    invalid_option: "Tuỳ chọn vừa chọn không hợp lệ cho phiên này.",
  },
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
    awaiting_clarification: "Waiting for your input",
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
    required_skill_unavailable:
      "Cannot continue because a required agent instruction is unavailable.",
    skill_unavailable: "The requested skill is not available.",
    provider_gateway_soft_error:
      "The AI provider is temporarily unavailable or overloaded. Retry in a moment.",
  } as Record<BuilderRunFailureCode, string>,
  clarification: {
    questionScaffold: "Which approach should we take for this request?",
    submitButton: "Continue",
    cancelHint: "Or cancel to end the run.",
    freeTextLabel: "Or briefly describe your preference",
  },
  apiErrors: {
    not_paused: "Run is not awaiting clarification.",
    empty_answer: "Answer cannot be empty.",
    invalid_option: "Selected option is not valid for this run.",
  },
  commerceValidationSkippedWarning:
    "Cart and checkout flows were not fully validated in phase 1.",
};
