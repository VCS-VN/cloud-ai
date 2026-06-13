---
target: src/services/store/use-categories-list.ts
---
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/http/client";
import { hasStoreSlug } from "@/services/store/use-store-detail";
import { categories as sampleCategories } from "@/data/categories";

export type Category = { id: string; name: string; storeId?: string };
export type CategoriesList = { total: number; data: Category[] };

export function useCategoriesList(input: { storeId?: string }) {
  const storeId = input.storeId;

  const query = useQuery({
    queryKey: ["categories-list", storeId],
    enabled: hasStoreSlug && Boolean(storeId),
    queryFn: async (): Promise<CategoriesList> => {
      const res = await apiClient.get<CategoriesList>("/api/v1/categories", {
        params: { storeId },
      });
      return res.data;
    },
  });

  if (!hasStoreSlug) {
    return {
      categories: sampleCategories as Category[],
      total: sampleCategories.length,
      isLoading: false,
      isError: false,
      error: null as unknown,
      refetch: () => undefined,
    };
  }

  return {
    categories: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as unknown,
    refetch: query.refetch,
  };
}
