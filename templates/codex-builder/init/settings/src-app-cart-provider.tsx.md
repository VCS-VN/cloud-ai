---
target: src/app/cart-provider.tsx
---
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/services/http/client";
import { useStore } from "@/app/store-provider";
import { useAuth } from "@/app/auth-provider";
import type { Product, ProductModel } from "@/services/store/use-products-list";

const GUEST_CART_KEY = "store_cart";

export type CartItem = {
  id: string;
  product: Product;
  model: ProductModel;
  quantity: number;
};

type CartShape = {
  data: { store: string | undefined; items: CartItem[] }[];
  total: number;
  totalItems: number;
};

type CartMode = "guest" | "user";

type CartContextValue = {
  cart: CartShape;
  items: CartItem[];
  totalItems: number;
  isLoading: boolean;
  mode: CartMode;
  addItem: (input: {
    product: Product;
    model: ProductModel;
    quantity: number;
  }) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getItemQuantity: (id: string) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function emptyCart(): CartShape {
  return { data: [], total: 0, totalItems: 0 };
}

function itemsFromCart(cart: CartShape): CartItem[] {
  return cart.data.flatMap((group) => group.items);
}

function buildCart(items: CartItem[], storeId: string | undefined): CartShape {
  const totalItems = items.reduce((sum, it) => sum + it.quantity, 0);
  return {
    data: items.length > 0 ? [{ store: storeId, items }] : [],
    total: items.length,
    totalItems,
  };
}

function readGuestCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartShape;
    return itemsFromCart(parsed);
  } catch {
    return [];
  }
}

function writeGuestCart(cart: CartShape) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { storeDetail } = useStore();
  const { profile, isLoading: authLoading } = useAuth();
  const storeId = storeDetail?.id;
  const mode: CartMode = profile ? "user" : "guest";

  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load guest cart from localStorage on mount / when settling to guest mode.
  useEffect(() => {
    if (authLoading) return;
    if (mode === "guest") {
      setItems(readGuestCart());
      setIsLoading(false);
      return;
    }
    // User mode: load account cart; ignore failures and fall back to current items.
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<CartShape>("/api/v1/carts", {
        params: { page: 1, limit: 100, storeId },
      })
      .then((res) => {
        if (!cancelled) setItems(itemsFromCart(res.data ?? emptyCart()));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, mode, storeId]);

  // Persist guest cart whenever it changes.
  useEffect(() => {
    if (mode === "guest" && !isLoading) {
      writeGuestCart(buildCart(items, storeId));
    }
  }, [items, mode, storeId, isLoading]);

  const addItem = useCallback<CartContextValue["addItem"]>(
    ({ product, model, quantity }) => {
      setItems((prev) => {
        const existing = prev.find((it) => it.id === model.id);
        if (existing) {
          return prev.map((it) =>
            it.id === model.id
              ? { ...it, quantity: it.quantity + quantity }
              : it,
          );
        }
        return [...prev, { id: model.id, product, model, quantity }];
      });
      if (mode === "user") {
        void apiClient
          .post("/api/v1/carts", { id: model.id, quantity })
          .catch(() => undefined);
      }
    },
    [mode],
  );

  const updateItemQuantity = useCallback<
    CartContextValue["updateItemQuantity"]
  >(
    (id, quantity) => {
      if (quantity <= 0) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        if (mode === "user") {
          void apiClient.delete(`/api/v1/carts/${id}`).catch(() => undefined);
        }
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, quantity } : it)),
      );
      if (mode === "user") {
        void apiClient
          .patch(`/api/v1/carts/${id}`, { quantity })
          .catch(() => undefined);
      }
    },
    [mode],
  );

  const removeItem = useCallback<CartContextValue["removeItem"]>(
    (id) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (mode === "user") {
        void apiClient.delete(`/api/v1/carts/${id}`).catch(() => undefined);
      }
    },
    [mode],
  );

  const clearCart = useCallback<CartContextValue["clearCart"]>(() => {
    setItems([]);
    if (mode === "user") {
      void apiClient
        .delete("/api/v1/carts/all", { params: { storeId } })
        .catch(() => undefined);
    }
  }, [mode, storeId]);

  const getItemQuantity = useCallback(
    (id: string) => items.find((it) => it.id === id)?.quantity ?? 0,
    [items],
  );

  const cart = useMemo(() => buildCart(items, storeId), [items, storeId]);
  const totalItems = cart.totalItems;

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      items,
      totalItems,
      isLoading,
      mode,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
      getItemQuantity,
    }),
    [
      cart,
      items,
      totalItems,
      isLoading,
      mode,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
      getItemQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
