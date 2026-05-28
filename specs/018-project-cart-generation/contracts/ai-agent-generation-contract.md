# AI Agent Generation Contract

This contract defines what Builder source and prompts must generate.

## Initial Generated Files

Generated project layout must include:
- `src/app/auth-provider.tsx`
- `src/app/cart-provider.tsx`
- `src/app/cart-selection.ts`
- `src/routes/cart.tsx`
- `src/routes/checkout.tsx`
- `src/routes/products/$productId.tsx`
- `src/components/layout/site-header.tsx`
- `src/components/store/cart-item.tsx`
- `src/services/http/client.ts`

## Prompt Requirements

Initial project prompt must instruct generated code to:
- Use active cart state, not placeholder cart messaging.
- Use provider order `Providers -> StoreProvider -> AuthProvider -> CartProvider`.
- Use shared HTTP client for all profile/cart API calls.
- Keep HTTP interceptor behavior intact.
- Use guest cart key `store_cart`.
- Use selected model id as cart item id.
- Require explicit model selection before product detail add/update.
- Use default model only for initial price display.
- Update account cart UI before persistence and ignore mutation responses/failures.
- Store selected checkout ids globally, not full selected item snapshots.
- Navigate checkout with `method=cart`.
- Keep cart drawer wiring out of scope.
- Follow `DESIGN.md` tokens for cart UI.

Runtime update prompt must preserve the same contracts when modifying existing generated storefronts.

## Source Generator Requirements

Initial source generator must produce:
- AuthProvider source.
- Active CartProvider source.
- Cart selection atom/source.
- Root provider order update.
- Product detail cart integration.
- Header cart count badge.
- Cart route with selection and selected summary.
- Checkout route that can read cart-origin selection.
- Cart item component with active quantity/remove controls.

## Validation Requirements

Generated project validation should catch:
- Missing AuthProvider or CartProvider exports.
- Incorrect root provider order.
- Product detail add/update without explicit model selection.
- Native fetch usage for storefront profile/cart APIs.
- Missing cart badge count.
- Cart route still showing cart "coming soon" placeholder.
- Stored full selected item snapshots instead of selected ids.

## Out of Scope

- Backend API implementation.
- Payment/order creation.
- Cart drawer UX.
- Database schema changes.
