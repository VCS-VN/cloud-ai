import { describe, expect, it } from "vitest";
import { dumprify } from "@/lib/dumprify";

describe("dumprify", () => {
  it("sanitizes dangerous html while preserving safe formatting", () => {
    const html = dumprify(
      "### Status\n- Ready\n<script>alert(1)</script>\nUse `code` and **bold**.",
    );

    expect(html).toContain("<h3>Status</h3>");
    expect(html).toContain("<ul><li>Ready</li></ul>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("drops inline event handlers and unsupported tags", () => {
    const html = dumprify(
      '<p onclick="alert(1)">Hi</p>\n<iframe src="https://example.com"></iframe>',
    );

    expect(html).toContain("<p>Hi</p>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("iframe");
  });
});
