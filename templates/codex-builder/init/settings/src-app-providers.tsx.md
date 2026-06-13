---
target: src/app/providers.tsx
---
import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoreProvider } from "@/app/store-provider";
import { AuthProvider } from "@/app/auth-provider";
import { CartProvider } from "@/app/cart-provider";

// Full storefront provider stack in dependency order. The nesting is fixed and
// runtime-owned because it is pure plumbing the model cannot get right: Cart
// calls useStore()+useAuth() so it MUST be inside both, and Store/Auth use
// react-query so they MUST be inside QueryClientProvider. Order is therefore
// always QueryClient > Store > Auth > Cart. __root.tsx only renders
// <Providers>…app chrome + Outlet…</Providers>; it must NOT re-wire these.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}
