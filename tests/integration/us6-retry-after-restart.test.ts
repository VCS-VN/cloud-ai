import { describe, expect, it } from "vitest";
import { friendlyFailureMessage } from "@/server/services/builder-run-translator.server";

describe("US6 — retry after restart surfaces the friendly interrupted copy", () => {
  it("interrupted_by_restart maps to a privacy-safe vi message that mentions retry", () => {
    const vi = friendlyFailureMessage("interrupted_by_restart", "vi");
    expect(vi.toLowerCase()).toMatch(/gián đoạn|thử lại/);
  });

  it("interrupted_by_restart maps to a privacy-safe en message that mentions retry", () => {
    const en = friendlyFailureMessage("interrupted_by_restart", "en");
    expect(en.toLowerCase()).toMatch(/interrupt|retry/);
  });
});
