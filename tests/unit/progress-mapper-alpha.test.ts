import { describe, expect, it } from "vitest";
import { phaseLabel } from "@/server/functions/progress-mapper.server";
import type { BuilderRunMilestone } from "@/features/agents/ui/builder-events";

const TABLE: Array<[BuilderRunMilestone, string, string]> = [
  ["loading_context", "Đang đọc cấu trúc trang", "Reading page structure"],
  ["planning", "Đang lên kế hoạch chỉnh sửa", "Planning the edit"],
  ["creating_draft", "Đang chuẩn bị bản nháp", "Preparing draft workspace"],
  ["building_pages", "Đang dựng các trang/khối", "Building pages and sections"],
  ["checking_preview", "Đang kiểm tra preview", "Checking the preview"],
  ["repairing", "Đang tự sửa các lỗi nhỏ", "Self-healing small errors"],
  ["publishing", "Đang lưu thay đổi", "Publishing changes"],
  [
    "awaiting_clarification",
    "Đang chờ bạn xác nhận lựa chọn",
    "Waiting for your selection",
  ],
  ["done", "Hoàn tất", "Done"],
  ["failed", "Đã xảy ra lỗi", "An error occurred"],
  ["cancelled", "Đã huỷ", "Cancelled"],
];

describe("α — phaseLabel matches contract for every milestone in vi + en", () => {
  for (const [phase, vi, en] of TABLE) {
    it(`${phase} → vi:"${vi}", en:"${en}"`, () => {
      expect(phaseLabel(phase, "vi")).toBe(vi);
      expect(phaseLabel(phase, "en")).toBe(en);
    });
  }
});
