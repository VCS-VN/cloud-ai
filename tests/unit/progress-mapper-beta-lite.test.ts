import { describe, expect, it } from "vitest";
import { extractSummary } from "@/server/functions/progress-mapper.server";

describe("β-lite summary extraction", () => {
  it("passes through a clean candidate (first paragraph) in vi", () => {
    const text = "Đã thêm ảnh vào phần hero ở trang chủ.\n\nThêm chi tiết khác không cần thiết.";
    expect(extractSummary(text, "vi")).toBe("Đã thêm ảnh vào phần hero ở trang chủ.");
  });

  it("passes through a clean candidate in en", () => {
    const text = "Updated the hero section on the home page.\n\nMore detail follows.";
    expect(extractSummary(text, "en")).toBe(
      "Updated the hero section on the home page.",
    );
  });

  it("falls back to phase-default (vi) when candidate contains a file path", () => {
    expect(
      extractSummary(
        "Updated src/components/storefront/Hero.tsx with new content",
        "vi",
      ),
    ).toBe("Đã hoàn tất yêu cầu của bạn.");
  });

  it("falls back to phase-default (en) when candidate contains a code fence", () => {
    expect(extractSummary("```ts\nlet x = 1;\n```", "en")).toBe(
      "Done with your request.",
    );
  });

  it("falls back to phase-default when candidate contains a framework token", () => {
    expect(extractSummary("Built with React and Vite", "vi")).toBe(
      "Đã hoàn tất yêu cầu của bạn.",
    );
  });

  it("returns fallback for empty input", () => {
    expect(extractSummary("", "vi")).toBe("Đã hoàn tất yêu cầu của bạn.");
    expect(extractSummary("", "en")).toBe("Done with your request.");
  });

  it("truncates clean text longer than 400 chars", () => {
    const long = "Đã hoàn tất việc thêm ảnh vào hero. ".repeat(50);
    const out = extractSummary(long, "vi");
    expect(out.length).toBeLessThanOrEqual(400);
  });

  it("trims whitespace from the first paragraph before filtering", () => {
    const text = "   Đã cập nhật phần hero.   \n\nNothing else.";
    expect(extractSummary(text, "vi")).toBe("Đã cập nhật phần hero.");
  });
});
