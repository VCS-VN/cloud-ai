import { describe, expect, it } from "vitest";
import {
  validateDesignVariants,
} from "@/features/agents/codex/runtime/design-variants.server";
import type { DesignVariant } from "@/shared/project-types";

const HEX = (h: string) => h;

const VALID_FOUR: DesignVariant[] = [
  {
    id: "minimal-retail",
    label: "Minimal Retail",
    description: "Khoảng trắng rộng, typography thanh thoát, ưu tiên sản phẩm.",
    preview: {
      font: "Inter",
      palette: [HEX("#ffffff"), HEX("#1a1a1a"), HEX("#cccccc")],
      motion: 0.2,
    },
  },
  {
    id: "warm-retail",
    label: "Warm Retail",
    description: "Tông màu ấm, ánh nâu kem, thân thiện và gần gũi với khách hàng.",
    preview: {
      font: "Lora",
      palette: [HEX("#fdf6ec"), HEX("#a05a2c"), HEX("#5e3a1d"), HEX("#e7c894")],
      motion: 0.4,
    },
  },
  {
    id: "luxury-retail",
    label: "Luxury Retail",
    description: "Đen huyền, ánh kim, không gian cao cấp dành cho khách hàng tinh tế.",
    preview: {
      font: "Playfair Display",
      palette: [HEX("#0e0e0e"), HEX("#bfa269"), HEX("#f4f1ec")],
      motion: 0.3,
      density: 0.6,
    },
  },
  {
    id: "playful-retail",
    label: "Playful Retail",
    description: "Sắc màu tươi sáng, hoạt tiết vui mắt, mời gọi khách hàng trẻ trung.",
    preview: {
      font: "Quicksand",
      palette: [HEX("#fef08a"), HEX("#34d399"), HEX("#fb7185"), HEX("#60a5fa")],
      motion: 0.7,
    },
  },
];

describe("DesignVariant strict schema (US4)", () => {
  it("accepts a valid 4-variant payload", () => {
    const result = validateDesignVariants(VALID_FOUR);
    expect(result.ok).toBe(true);
  });

  it("rejects fewer than 4 variants", () => {
    const result = validateDesignVariants(VALID_FOUR.slice(0, 3));
    expect(result.ok).toBe(false);
  });

  it("rejects more than 4 variants", () => {
    const fifth = { ...VALID_FOUR[0], id: "extra" };
    const result = validateDesignVariants([...VALID_FOUR, fifth]);
    expect(result.ok).toBe(false);
  });

  it("rejects palette length < 3", () => {
    const tooShort = [...VALID_FOUR];
    tooShort[0] = {
      ...tooShort[0],
      preview: { ...tooShort[0].preview, palette: [HEX("#ffffff"), HEX("#000000")] },
    };
    const result = validateDesignVariants(tooShort);
    expect(result.ok).toBe(false);
  });

  it("rejects palette length > 5", () => {
    const tooLong = [...VALID_FOUR];
    tooLong[0] = {
      ...tooLong[0],
      preview: {
        ...tooLong[0].preview,
        palette: [
          HEX("#000000"),
          HEX("#111111"),
          HEX("#222222"),
          HEX("#333333"),
          HEX("#444444"),
          HEX("#555555"),
        ],
      },
    };
    const result = validateDesignVariants(tooLong);
    expect(result.ok).toBe(false);
  });

  it("rejects palette entries that aren't 6/8-digit hex with leading #", () => {
    const bad = [...VALID_FOUR];
    bad[0] = {
      ...bad[0],
      preview: { ...bad[0].preview, palette: ["red", HEX("#ffffff"), HEX("#000000")] },
    };
    const result = validateDesignVariants(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects descriptions longer than 120 chars", () => {
    const long = [...VALID_FOUR];
    long[0] = { ...long[0], description: "A".repeat(121) };
    const result = validateDesignVariants(long);
    expect(result.ok).toBe(false);
  });

  it("rejects descriptions that fail the privacy filter (contains a file path)", () => {
    const leaky = [...VALID_FOUR];
    leaky[0] = {
      ...leaky[0],
      description: "Mở rộng src/components/storefront/Hero.tsx cho banner mới.",
    };
    const result = validateDesignVariants(leaky);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate ids within the payload", () => {
    const dup = [...VALID_FOUR];
    dup[1] = { ...dup[1], id: dup[0].id };
    const result = validateDesignVariants(dup);
    expect(result.ok).toBe(false);
  });
});
