---
target: src/lib/format-money.ts
---
import type { Product, ProductModel } from "@/services/store/use-products-list";

export function formatMoney(
  amountInCents: number,
  options: { currency?: string; locale?: string } = {},
): string {
  const { currency = "AUD", locale = "en-AU" } = options;
  const dollars = Math.round(amountInCents) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(dollars);
}

export function resolveProductPrice(
  product: Pick<Product, "price" | "defaultModel" | "models">,
): number {
  if (product.defaultModel?.price != null) return product.defaultModel.price;
  const firstModel: ProductModel | undefined = product.models?.[0];
  if (firstModel?.price != null) return firstModel.price;
  return product.price ?? 0;
}
