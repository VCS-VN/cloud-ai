---
target: src/services/store/use-product-suggestions.ts
---
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/http/client";
import { hasStoreSlug } from "@/services/store/use-store-detail";
import { products as sampleProducts } from "@/data/products";

export type ProductSuggestionsList = { total: number; data: string[] };

export function useProductSuggestions(input: {
  storeId?: string;
  query: string;
}) {
  const storeId = input.storeId;
  const query = input.query ?? "";
  const trimmed = query.trim();

  const apiQuery = useQuery({
    queryKey: ["product-suggestions", storeId, trimmed],
    enabled: hasStoreSlug && Boolean(storeId) && trimmed.length > 0,
    queryFn: async (): Promise<ProductSuggestionsList> => {
      const res = await apiClient.get<ProductSuggestionsList>(
        "/api/v1/products/suggestions",
        { params: { storeId, query: trimmed } },
      );
      return res.data;
    },
  });

  if (!hasStoreSlug || trimmed.length === 0) {
    const matches = trimmed
      ? Array.from(
          new Set(
            sampleProducts
              .map((p) => p.name)
              .filter((name) =>
                name.toLowerCase().includes(trimmed.toLowerCase()),
              ),
          ),
        ).slice(0, 8)
      : [];
    return {
      suggestions: matches,
      total: matches.length,
      isLoading: false,
      isError: false,
      error: null as unknown,
      refetch: () => undefined,
    };
  }

  return {
    suggestions: apiQuery.data?.data ?? [],
    total: apiQuery.data?.total ?? 0,
    isLoading: apiQuery.isLoading,
    isError: apiQuery.isError,
    error: apiQuery.error as unknown,
    refetch: apiQuery.refetch,
  };
}
