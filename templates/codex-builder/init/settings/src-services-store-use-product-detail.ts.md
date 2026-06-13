---
target: src/services/store/use-product-detail.ts
---
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/http/client";
import { hasStoreSlug } from "@/services/store/use-store-detail";
import type { Product } from "@/services/store/use-products-list";
import { products as sampleProducts } from "@/data/products";

export type ProductDetail = Product;

export function useProductDetail(productId: string | undefined) {
  const query = useQuery({
    queryKey: ["product-detail", productId],
    enabled: hasStoreSlug && Boolean(productId),
    queryFn: async (): Promise<ProductDetail> => {
      const res = await apiClient.get<ProductDetail>(
        `/api/v1/products/${productId}`,
        { params: { isGettingModels: true, isGettingDefaultModel: true } },
      );
      return res.data;
    },
  });

  if (!hasStoreSlug) {
    const found = sampleProducts.find((p) => p.id === productId);
    return {
      data: found as ProductDetail | undefined,
      isLoading: false,
      isError: false,
      error: null as unknown,
      refetch: () => undefined,
    };
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as unknown,
    refetch: query.refetch,
  };
}
