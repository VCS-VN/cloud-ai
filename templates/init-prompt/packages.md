---
layer: PACKAGES
warning: >
  Danh sách module/hook mà AI được phép import khi sinh storefront. Gửi nguyên
  văn tới model (frontmatter bị strip). KHÔNG phải package.json — đây chỉ là
  "những gì được phép import". Sửa sai → AI import thứ không tồn tại.
---
IMPORTS AVAILABLE:
- { websiteConfig } from "@/lib/website-config"
- { formatMoney, resolveProductPrice } from "@/lib/format-money"
- { cn } from "@/lib/utils"
- { StoreProvider, useStore } from "@/app/store-provider"  // useStore() returns { storeDetail, isLoading, error, refetch, isUsingSampleData }; storeDetail.setting?.currency carries the ISO currency (default fallback: AUD)
- { AuthProvider, useAuth } from "@/app/auth-provider"  // AuthProvider loads GET /api/v1/auth/profile via apiClient; profile present means user cart mode; logout clears profile and auth tokens
- { CartProvider, useCart } from "@/app/cart-provider"  // active cart state for guest/user modes; guest uses localStorage key store_cart; user uses cart APIs through apiClient
- { selectedCartItemIdsAtom } from "@/app/cart-selection"  // Jotai atom storing selected cart item ids only for checkout preparation
- { sampleStore } from "@/data/sample-store"
- { useStoreDetail, hasStoreSlug, type StoreDetail, type StoreSetting } from "@/services/store/use-store-detail"
- { useProductsList, type Product, type ProductModel, type ProductsList } from "@/services/store/use-products-list"
- { useProductDetail, type ProductDetail } from "@/services/store/use-product-detail"
- { useCategoriesList, type Category, type CategoriesList } from "@/services/store/use-categories-list"
- { useProductSuggestions, type ProductSuggestionsList } from "@/services/store/use-product-suggestions"

shadcn UI primitives are already generated on disk and ready to import from @/components/ui/*: button, card, input, badge, separator, label, select, radio-group, dialog, sheet, sonner. Do NOT create these files — import them.

// @/data/products and @/data/categories exist as internal sample fallbacks for the hooks above. Routes and store components MUST NOT import them directly — always consume the hooks.