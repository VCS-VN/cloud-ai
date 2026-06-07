import { describe, expect, it } from "vitest";
import { renderUserGuide } from "@/lib/render-user-guide";

describe("renderUserGuide markdown engine", () => {
  it("renders h1-h4 with auto-slug ids", () => {
    const html = renderUserGuide("# Bắt đầu\n\n## Đăng nhập\n\n### Phần phụ\n\n#### Chi tiết");
    expect(html).toContain('<h1 id="bat-dau">');
    expect(html).toContain('<h2 id="dang-nhap">');
    expect(html).toContain('<h3 id="phan-phu">');
    expect(html).toContain('<h4 id="chi-tiet">');
  });

  it("respects explicit {#id} suffix on headings", () => {
    const html = renderUserGuide("## Đăng nhập {#login}");
    expect(html).toContain('<h2 id="login">Đăng nhập</h2>');
  });

  it("renders ordered + unordered lists", () => {
    const ul = renderUserGuide("- một\n- hai\n- ba");
    expect(ul).toBe("<ul><li>một</li><li>hai</li><li>ba</li></ul>");
    const ol = renderUserGuide("1. một\n2. hai");
    expect(ol).toBe("<ol><li>một</li><li>hai</li></ol>");
  });

  it("renders GFM tables", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const html = renderUserGuide(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<thead><tr><th>a</th><th>b</th></tr></thead>");
    expect(html).toContain("<tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody>");
  });

  it("renders blockquotes with nested formatting", () => {
    const html = renderUserGuide("> **Mẹo**: hãy thử lại sau.\n> Câu thứ hai.");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<strong>Mẹo</strong>");
  });

  it("renders inline links", () => {
    const html = renderUserGuide("Xem [section bắt đầu](#bat-dau).");
    expect(html).toContain('<a href="#bat-dau">section bắt đầu</a>');
  });

  it("renders inline bold + italic + code", () => {
    const html = renderUserGuide("Bấm **Save** nút *quan trọng* và xem `code`.");
    expect(html).toContain("<strong>Save</strong>");
    expect(html).toContain("<em>quan trọng</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("renders fenced code blocks", () => {
    const html = renderUserGuide("```\nhello world\n```");
    expect(html).toContain("<pre><code>hello world</code></pre>");
  });

  it("renders horizontal rule", () => {
    expect(renderUserGuide("---")).toBe("<hr />");
  });

  it("escapes script-like input safely", () => {
    const html = renderUserGuide("# <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });
});
