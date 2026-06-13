import type { BuilderRunFailureCode } from "@/features/agents/ui/builder-events";

export type FailureLocale = "vi" | "en";

const VI: Record<BuilderRunFailureCode, string> = {
  validation_failed: "Bản dựng không qua kiểm tra. Vui lòng thử lại.",
  boundary_violation: "Yêu cầu bị chặn vì lý do an toàn.",
  config_unavailable: "Trình tạo AI hiện chưa sẵn sàng. Hãy thử lại sau.",
  cancelled: "Đã huỷ.",
  preview_failed: "Preview chưa lên được. Hãy thử lại.",
  codex_runtime_failed: "Trình tạo gặp lỗi tạm thời. Hãy thử lại.",
  blocked_request: "Yêu cầu nằm ngoài phạm vi.",
  repair_exhausted: "Vẫn còn lỗi sau khi tự sửa. Hãy thử lại.",
  required_skill_unavailable: "Thiếu hướng dẫn bắt buộc.",
  skill_unavailable: "Skill được yêu cầu chưa có sẵn.",
  interrupted_by_restart: "Phiên xử lý bị gián đoạn. Bạn có thể thử lại an toàn.",
  provider_drops_reasoning:
    "Nhà cung cấp AI không giữ lại phần suy luận giữa các bước nên không thể dựng nhiều bước. Cần bật lưu reasoning ở provider, rồi thử lại.",
  provider_gateway_soft_error:
    "Nhà cung cấp AI đang lỗi tạm thời hoặc quá tải. Hãy thử chạy lại sau ít phút.",
  build_produced_no_files:
    "Trình tạo kết thúc mà không tạo được file nào cho storefront. Hãy thử lại.",
  apply_patch_unavailable:
    "Máy chủ chưa bật chế độ ghi file cho trình tạo (sandbox chặn apply_patch). Cần đặt CODEX_DISABLE_SANDBOX=true trong môi trường rồi khởi động lại.",
  files_corrupted:
    "Một số file bị ghi lặp nội dung và không tự sửa được. Hãy thử tạo lại.",
};

const EN: Record<BuilderRunFailureCode, string> = {
  validation_failed: "The build did not pass validation. Try again.",
  boundary_violation: "The request was blocked for safety.",
  config_unavailable: "The AI builder is unavailable. Try again later.",
  cancelled: "Cancelled.",
  preview_failed: "The preview did not come up. Try again.",
  codex_runtime_failed: "The builder hit a temporary error. Try again.",
  blocked_request: "The request is out of scope.",
  repair_exhausted: "Errors remained after self-healing. Try again.",
  required_skill_unavailable: "Required guidance is missing.",
  skill_unavailable: "The requested skill is not available.",
  interrupted_by_restart: "The session was interrupted. You can retry safely.",
  provider_drops_reasoning:
    "The AI provider does not preserve reasoning between steps, so multi-step builds cannot run. Enable reasoning retention on the provider, then retry.",
  provider_gateway_soft_error:
    "The AI provider is temporarily unavailable or overloaded. Retry in a moment.",
  build_produced_no_files:
    "The builder finished without creating any storefront files. Try again.",
  apply_patch_unavailable:
    "The host has not enabled file writes for the builder (the sandbox blocks apply_patch). Set CODEX_DISABLE_SANDBOX=true in the environment and restart.",
  files_corrupted:
    "Some files were written with duplicated content and could not be auto-repaired. Try recreating the project.",
};

export function friendlyFailureMessage(
  code: BuilderRunFailureCode,
  locale: FailureLocale,
): string {
  return locale === "vi" ? VI[code] : EN[code];
}
