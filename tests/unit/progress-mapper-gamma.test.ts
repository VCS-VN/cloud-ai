import { describe, expect, it } from "vitest";
import { fileChangeToSection } from "@/server/functions/progress-mapper.server";

const ROWS = [
  // [filePath, vi, en]
  ["src/routes/index.tsx", "trang chủ", "the home page"],
  [
    "src/routes/products/index.tsx",
    "trang danh sách sản phẩm",
    "the products page",
  ],
  [
    "src/routes/products/$productId.tsx",
    "trang chi tiết sản phẩm",
    "the product detail page",
  ],
  ["src/routes/cart.tsx", "trang giỏ hàng", "the cart page"],
  ["src/routes/checkout.tsx", "trang thanh toán", "the checkout page"],
  ["src/routes/__root.tsx", "khung chung của site", "the global frame"],
  [
    "src/components/storefront/Hero.tsx",
    "phần hero",
    "the hero section",
  ],
  [
    "src/components/storefront/ProductCard.tsx",
    "khối sản phẩm",
    "the product tile",
  ],
  [
    "src/components/storefront/ProductGrid.tsx",
    "khu sản phẩm",
    "the product grid",
  ],
  ["src/components/storefront/Header.tsx", "phần đầu trang", "the header"],
  ["src/components/storefront/Footer.tsx", "phần chân trang", "the footer"],
  [
    "src/components/storefront/CartDrawer.tsx",
    "ngăn kéo giỏ hàng",
    "the cart drawer",
  ],
  [
    "src/components/storefront/Banner.tsx",
    "banner khuyến mãi",
    "the promo banner",
  ],
  [
    "src/components/storefront/Promo.tsx",
    "banner khuyến mãi",
    "the promo banner",
  ],
  ["src/styles/app.css", "hệ thống thiết kế", "the design system"],
  ["DESIGN.md", "hệ thống thiết kế", "the design system"],
  // generic component fallback
  [
    "src/components/some/Misc.tsx",
    "một phần của giao diện",
    "a UI section",
  ],
] as const;

describe("γ — fileChangeToSection (every contract row mapped)", () => {
  for (const [path, vi, en] of ROWS) {
    it(`maps ${path} → vi:${vi}, en:${en}`, () => {
      expect(fileChangeToSection(path, "vi")).toBe(vi);
      expect(fileChangeToSection(path, "en")).toBe(en);
    });
  }

  it("returns null for paths outside the table (suppression)", () => {
    expect(fileChangeToSection("src/server/index.ts", "vi")).toBeNull();
    expect(fileChangeToSection("README.md", "vi")).toBeNull();
    expect(fileChangeToSection("package.json", "vi")).toBeNull();
    expect(fileChangeToSection("vite.config.ts", "en")).toBeNull();
    expect(fileChangeToSection("", "vi")).toBeNull();
  });
});
