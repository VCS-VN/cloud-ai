---
target: src/app/store-provider.tsx
---
import { createContext, useContext, type ReactNode } from "react";
import {
  useStoreDetail,
  hasStoreSlug,
  type StoreDetail,
} from "@/services/store/use-store-detail";

type StoreContextValue = {
  storeDetail: StoreDetail | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
  isUsingSampleData: boolean;
};

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function StorefrontLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background text-foreground"
    >
      <svg
        className="h-12 w-12 animate-spin text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <p className="text-sm font-medium">Loading store…</p>
    </div>
  );
}

function StorefrontErrorScreen({ onRetry }: { onRetry: () => unknown }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <p className="text-sm font-medium">We couldn't load this store.</p>
      <button
        type="button"
        onClick={() => onRetry()}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, error, refetch, isUsingSampleData } =
    useStoreDetail();

  if (hasStoreSlug && isLoading) return <StorefrontLoadingScreen />;
  if (hasStoreSlug && isError) return <StorefrontErrorScreen onRetry={refetch} />;

  return (
    <StoreContext.Provider
      value={{
        storeDetail: data,
        isLoading,
        error,
        refetch,
        isUsingSampleData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (ctx === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return ctx;
}
