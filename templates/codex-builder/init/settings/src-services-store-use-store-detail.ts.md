---
target: src/services/store/use-store-detail.ts
---
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/http/client";
import { sampleStore } from "@/data/sample-store";

export type StoreSetting = { currency?: string };
export type StoreDetail = {
  id: string;
  name: string;
  slug?: string;
  setting?: StoreSetting;
};

export const hasStoreSlug = Boolean(import.meta.env.VITE_STORE_SLUG);
export const isClientRuntime = typeof window !== "undefined";

const storeSlug = String(import.meta.env.VITE_STORE_SLUG ?? "");

export function useStoreDetail() {
  const query = useQuery({
    queryKey: ["store-detail", storeSlug],
    enabled: hasStoreSlug && isClientRuntime,
    queryFn: async (): Promise<StoreDetail> => {
      const res = await apiClient.get<StoreDetail>(
        `/api/v1/stores/${storeSlug}`,
      );
      return res.data;
    },
  });

  if (!hasStoreSlug) {
    return {
      data: sampleStore,
      isLoading: false,
      isError: false,
      error: null as unknown,
      refetch: () => undefined,
      isUsingSampleData: true,
    };
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as unknown,
    refetch: query.refetch,
    isUsingSampleData: false,
  };
}
