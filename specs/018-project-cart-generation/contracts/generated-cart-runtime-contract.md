# Generated Cart Runtime Contract

This contract defines generated storefront behavior.

## Provider Order

Generated root route must render:

```text
Providers
└── StoreProvider
    └── AuthProvider
        └── CartProvider
```

Rules:
- StoreProvider resolves current store before cart starts.
- AuthProvider resolves shopper profile before cart starts.
- CartProvider loads cart only after store and auth are settled.

## Auth Provider

Outputs:
- `profile`
- `isLoading`
- `isAuthenticated`
- `logout()`

Rules:
- Profile success sets user mode.
- Unauthorized profile lookup clears credentials and profile.
- Logout clears credentials and profile.
- No profile error is exposed to UI.

## Cart Provider

Outputs:
- `cart`
- `items`
- `totalItems`
- `isLoading`
- `mode`
- `addItem(input)`
- `updateItemQuantity(id, quantity)`
- `removeItem(id)`
- `clearCart()`
- `getItemQuantity(id)`

Rules:
- `mode` is `user` when profile exists, otherwise `guest`.
- Guest mode reads/writes `store_cart`.
- User mode loads page 1, limit 100 for current store.
- User mode merges guest cart first only when guest items exist.
- User mutations update UI first, call persistence second, ignore response, ignore failure.
- Guest mutations update state and persist to `store_cart`.

## Product Detail

Rules:
- No model is selected on initial render.
- Default model may display price only.
- Add/update action is disabled until shopper selects a model.
- Desktop action label is `Add to cart` for new selected model and `Update cart` for existing selected model.
- Mobile sheet can open before model selection so shoppers can choose a model there.
- Mobile confirm action remains disabled until model selection.
- Selected model quantity uses `getItemQuantity(model.id)` when present, otherwise 1.
- Existing selected model update sets quantity, not adds quantity.
- Quantity 0 removes the item.

## Product Cards

Rules:
- Product cards do not mutate cart.
- Product cards may link to product detail for model selection.

## Header

Rules:
- Cart icon links to cart route.
- Badge displays `totalItems` only when greater than 0.

## Cart Page

Rules:
- Empty cart renders empty state and continue shopping action.
- Non-empty cart renders grouped store cart items.
- Each item renders image, product name, selected model name, price, quantity controls, remove action, and checkbox.
- Default selection is empty.
- Select all toggles all visible item ids.
- Summary uses only selected item ids.
- Checkout action is disabled when no ids are selected.
- Checkout action stores selected ids globally and navigates to checkout with `method=cart`.
- Clear all clears current store cart and selected ids.

## Checkout Preparation

Rules:
- Checkout accepts cart-origin mode.
- Checkout derives selected item details from selected ids plus current cart state.
- Checkout order creation and payment are not part of this feature.

## UI Design

Rules:
- Cart, product detail, header badge, empty state, and checkout preparation UI must follow generated project `DESIGN.md`.
- Reference screenshots may guide layout only; tokens and visual styling must come from project design rules.
