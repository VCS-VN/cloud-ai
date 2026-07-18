import { describe, expect, it } from "vitest";
import { dumprify } from "@/lib/dumprify";

describe("dumprify", () => {
  it("escapes executable HTML during server rendering", () => {
    const html = dumprify('<img src=x onerror="alert(1)">\n<script>alert(2)</script>');

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });
});
