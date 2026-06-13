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
};

export function friendlyFailureMessage(
  code: BuilderRunFailureCode,
  locale: FailureLocale,
): string {
  return locale === "vi" ? VI[code] : EN[code];
}
