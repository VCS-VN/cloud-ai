---
target: src/services/store/use-products-list.ts
---
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/http/client";
import { hasStoreSlug } from "@/services/store/use-store-detail";
import { products as sampleProducts } from "@/data/products";

export type ProductModel = { id: string; name: string; price: number };
export type Product = {
  id: string;
  name: string;
  descriptions?: string;
  image?: string;
  images?: string[];
  category?: { id: string; name: string };
  price?: number;
  compareAtPrice?: number;
  defaultModel?: ProductModel;
  models?: ProductModel[];
};
export type ProductsList = { total: number; data: Product[] };

const PAGE_LIMIT = 12;

export function useProductsList(input: { storeId?: string; query?: string }) {
  const storeId = input.storeId;
  const query = input.query ?? "";

  const infinite = useInfiniteQuery({
    queryKey: ["products-list", storeId, query],
    enabled: hasStoreSlug && Boolean(storeId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ProductsList> => {
      const res = await apiClient.get<ProductsList>("/api/v1/products", {
        params: { limit: PAGE_LIMIT, page: pageParam, storeId, query },
      });
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.data.length, 0);
      const nextPage = allPages.length + 1;
      return loaded < lastPage.total ? nextPage : undefined;
    },
  });

  if (!hasStoreSlug) {
    const data = query
      ? sampleProducts.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase()),
        )
      : sampleProducts;
    return {
      products: data as Product[],
      total: data.length,
      fetchNextPage: () => undefined,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null as unknown,
      refetch: () => undefined,
    };
  }

  const pages = infinite.data?.pages ?? [];
  return {
    products: pages.flatMap((p) => p.data),
    total: pages[0]?.total ?? 0,
    fetchNextPage: infinite.fetchNextPage,
    hasNextPage: Boolean(infinite.hasNextPage),
    isFetchingNextPage: infinite.isFetchingNextPage,
    isLoading: infinite.isLoading,
    isError: infinite.isError,
    error: infinite.error as unknown,
    refetch: infinite.refetch,
  };
}
