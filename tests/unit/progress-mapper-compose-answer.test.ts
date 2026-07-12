import { describe, expect, it } from "vitest";
import { composeAnswerMessage } from "@/server/functions/progress-mapper.server";
import type { BuilderRunKind } from "@/features/agents/ui/builder-run-status";

describe("composeAnswerMessage — backward compat (runKind undefined)", () => {
  it("returns finalResponse.trim() verbatim when runKind is undefined (vi)", () => {
    const raw = "Đã thêm ảnh vào phần hero ở trang chủ.";
    expect(composeAnswerMessage({ finalResponse: `  ${raw}  `, locale: "vi" })).toBe(raw);
  });

  it("returns finalResponse.trim() verbatim when runKind is undefined (en)", () => {
    const raw = "Updated src/components/storefront/Hero.tsx with new content";
    expect(composeAnswerMessage({ finalResponse: raw, locale: "en" })).toBe(raw);
  });

  it("falls back to SUMMARY_FALLBACK[locale] when finalResponse is empty/whitespace (vi)", () => {
    expect(composeAnswerMessage({ finalResponse: "   ", locale: "vi" })).toBe(
      "Đã hoàn tất yêu cầu của bạn.",
    );
  });

  it("falls back to SUMMARY_FALLBACK[locale] when finalResponse is empty/whitespace (en)", () => {
    expect(composeAnswerMessage({ finalResponse: "", locale: "en" })).toBe(
      "Done with your request.",
    );
  });

  it("defaults locale to en when omitted", () => {
    expect(composeAnswerMessage({ finalResponse: "" })).toBe("Done with your request.");
  });
});

describe("composeAnswerMessage — headline per runKind", () => {
  const RUN_KINDS: BuilderRunKind[] = [
    "init",
    "update",
    "new_route",
    "generate_page",
    "redesign",
    "repair",
  ];

  const HEADLINE_NO_SECTION: Record<BuilderRunKind, { vi: string; en: string }> = {
    init: { vi: "Storefront của bạn đã sẵn sàng", en: "Your storefront is ready" },
    update: { vi: "Đã cập nhật storefront của bạn", en: "Updated your storefront" },
    new_route: { vi: "Đã cập nhật storefront của bạn", en: "Updated your storefront" },
    repair: { vi: "Đã cập nhật storefront của bạn", en: "Updated your storefront" },
    generate_page: { vi: "Đã dựng xong trang mới", en: "Built the new page" },
    redesign: { vi: "Đã làm mới thiết kế storefront", en: "Redesigned your storefront" },
  };

  for (const runKind of RUN_KINDS) {
    for (const locale of ["vi", "en"] as const) {
      it(`${runKind} without changedFiles (${locale}) uses the generic headline`, () => {
        const out = composeAnswerMessage({
          runKind,
          finalResponse: "hello",
          locale,
        });
        expect(out).toBe(`${HEADLINE_NO_SECTION[runKind][locale]}. hello`);
      });
    }
  }

  it("init with changedFiles still uses the fixed init headline (no section clause)", () => {
    const out = composeAnswerMessage({
      runKind: "init",
      changedFiles: ["src/components/storefront/Hero.tsx"],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Your storefront is ready. done");
  });

  it("generate_page with changedFiles still uses the fixed generate_page headline", () => {
    const out = composeAnswerMessage({
      runKind: "generate_page",
      changedFiles: ["src/components/storefront/Hero.tsx"],
      finalResponse: "done",
      locale: "vi",
    });
    expect(out).toBe("Đã dựng xong trang mới. done");
  });

  it("redesign with changedFiles still uses the fixed redesign headline", () => {
    const out = composeAnswerMessage({
      runKind: "redesign",
      changedFiles: ["src/components/storefront/Hero.tsx"],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Redesigned your storefront. done");
  });

  for (const runKind of ["update", "new_route", "repair"] as const) {
    it(`${runKind} with a single changedFiles section uses "Updated <section>" (en)`, () => {
      const out = composeAnswerMessage({
        runKind,
        changedFiles: ["src/components/storefront/Hero.tsx"],
        finalResponse: "done",
        locale: "en",
      });
      expect(out).toBe("Updated the hero section. done");
    });

    it(`${runKind} with a single changedFiles section uses "Đã cập nhật <section>" (vi)`, () => {
      const out = composeAnswerMessage({
        runKind,
        changedFiles: ["src/components/storefront/Hero.tsx"],
        finalResponse: "done",
        locale: "vi",
      });
      expect(out).toBe("Đã cập nhật phần hero. done");
    });
  }
});

describe("composeAnswerMessage — section joining", () => {
  it("joins two sections with 'và' (vi)", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: [
        "src/components/storefront/Hero.tsx",
        "src/components/storefront/Footer.tsx",
      ],
      finalResponse: "done",
      locale: "vi",
    });
    expect(out).toBe("Đã cập nhật phần hero và phần chân trang. done");
  });

  it("joins two sections with 'and' (en)", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: [
        "src/components/storefront/Hero.tsx",
        "src/components/storefront/Footer.tsx",
      ],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Updated the hero section and the footer. done");
  });

  it("joins three or more sections Oxford-comma style (en)", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: [
        "src/components/storefront/Hero.tsx",
        "src/components/storefront/Footer.tsx",
        "src/components/storefront/Header.tsx",
      ],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Updated the hero section, the footer, and the header. done");
  });

  it("joins three or more sections Oxford-comma style (vi)", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: [
        "src/components/storefront/Hero.tsx",
        "src/components/storefront/Footer.tsx",
        "src/components/storefront/Header.tsx",
      ],
      finalResponse: "done",
      locale: "vi",
    });
    expect(out).toBe("Đã cập nhật phần hero, phần chân trang, và phần đầu trang. done");
  });

  it("dedupes two paths mapping to the same section", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: [
        "src/components/storefront/Hero.tsx",
        "src/components/storefront/Hero.module.css",
      ],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Updated the hero section. done");
  });

  it("caps section list at 4 entries with no '...' suffix when more than 4 unique sections exist", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: [
        "src/routes/index.tsx",
        "src/routes/cart.tsx",
        "src/routes/checkout.tsx",
        "src/components/storefront/Header.tsx",
        "src/components/storefront/Footer.tsx",
      ],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe(
      "Updated the home page, the cart page, the checkout page, and the header. done",
    );
    expect(out).not.toContain("...");
    expect(out).not.toContain("the footer");
  });

  it("falls back to the generic 'Updated your storefront' headline when changedFiles map to no sections", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: ["src/server/util.ts", "package.json"],
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Updated your storefront. done");
  });

  it("treats changedFiles as [] when undefined", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      finalResponse: "done",
      locale: "en",
    });
    expect(out).toBe("Updated your storefront. done");
  });
});

describe("composeAnswerMessage — no content filter on finalResponse when runKind is set", () => {
  it("preserves a raw file path in finalResponse verbatim", () => {
    const ugly = "Updated src/components/storefront/Hero.tsx directly, see `useHero()`.";
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: ["src/components/storefront/Hero.tsx"],
      finalResponse: ugly,
      locale: "en",
    });
    expect(out).toContain(ugly);
  });

  it("preserves a code fence in finalResponse verbatim", () => {
    const ugly = "```ts\nconst x = 1;\n```";
    const out = composeAnswerMessage({
      runKind: "redesign",
      finalResponse: ugly,
      locale: "en",
    });
    expect(out).toContain(ugly);
  });

  it("returns just '<headline>.' with no trailing space/artifact when finalResponse is empty and runKind is set", () => {
    const out = composeAnswerMessage({
      runKind: "init",
      finalResponse: "   ",
      locale: "en",
    });
    expect(out).toBe("Your storefront is ready.");
  });

  it("returns just '<headline>.' with no trailing artifact for a section headline (vi)", () => {
    const out = composeAnswerMessage({
      runKind: "update",
      changedFiles: ["src/components/storefront/Hero.tsx"],
      finalResponse: "",
      locale: "vi",
    });
    expect(out).toBe("Đã cập nhật phần hero.");
  });
});
