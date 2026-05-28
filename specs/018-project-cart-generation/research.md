# Research: Project Cart Generation

## Decision: Provider order is StoreProvider, then AuthProvider, then CartProvider

**Rationale**: Cart setup requires current store identity and resolved profile mode. Store first gives `storeId`; auth second resolves profile and logout state; cart last can safely choose guest or account mode.

**Alternatives considered**:
- Auth before store: rejected because cart would still need to wait for store identity.
- Cart before auth: rejected because it creates guest cart flash and later overwrite risk.

## Decision: AuthProvider owns profile lookup and logout

**Rationale**: Profile presence is the mode boundary. The generated provider should load shopper profile, expose profile/loading/authenticated/logout state, clear credentials on logout, and treat unauthorized profile lookup as guest mode.

**Alternatives considered**:
- Detect mode only from access token: rejected because stale tokens can exist without a valid profile.
- Put profile state inside CartProvider: rejected because auth state is shared storefront context, not cart-only state.

## Decision: All generated API calls use existing apiClient

**Rationale**: The generated HTTP client already centralizes base URL, auth header, token refresh, retry, and error normalization. New profile/cart services must preserve that behavior.

**Alternatives considered**:
- Native fetch for cart/profile: rejected because it bypasses interceptors and token refresh.
- Create a second Axios instance: rejected because duplicate interceptor behavior is fragile and unnecessary.

## Decision: Guest cart uses fixed local storage key `store_cart`

**Rationale**: User explicitly chose one fixed key for generated projects. Guest and account cart share the same data shape, so provider and UI can avoid mode-specific rendering branches.

**Alternatives considered**:
- Store-scoped keys such as `cart:{storeId}`: rejected by user preference.
- Minimal guest item list shape: rejected because it would require shape conversion for UI.

## Decision: Selected model id is cart item identity

**Rationale**: Product models represent purchasable variants. User confirmed add/update/delete and bulk merge use selected model id, while the cart line also carries product summary for display.

**Alternatives considered**:
- Product id as identity: rejected because multiple models of one product must be distinct.
- Server cart row id: rejected because provided API contract uses selected model id.

## Decision: Product detail requires explicit model selection

**Rationale**: User requested no preselected model even when a default model exists. The default model only displays price. This avoids accidental add of the wrong model.

**Alternatives considered**:
- Preselect default model: rejected by user decision.
- Allow add with default model: rejected because explicit selection is required.

## Decision: Account cart mutations are immediate UI updates with fire-and-forget persistence

**Rationale**: User requested UI update before API call, no response sync, no rollback, and no error notification. Backend persistence exists only to make later reloads load updated data.

**Alternatives considered**:
- Refetch after each mutation: rejected by user.
- Optimistic rollback on failure: rejected by user.
- Toast error on failure: rejected by user.

## Decision: Cart page selection stores only ids globally

**Rationale**: User corrected selection storage to only selected item ids. Checkout should derive item details from current cart state. This avoids stale selected item snapshots.

**Alternatives considered**:
- Store full selected item snapshots: rejected by user.
- Keep selection local to cart page only: rejected because checkout needs selected ids after navigation.

## Decision: Keep cart drawer out of scope

**Rationale**: Header badge and cart route satisfy current requirements. Drawer wiring would add UI scope not requested.

**Alternatives considered**:
- Wire existing cart drawer scaffold: rejected as unnecessary for this feature.
