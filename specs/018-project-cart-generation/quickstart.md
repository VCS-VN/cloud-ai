# Quickstart: Project Cart Generation

## Preconditions

- Current branch: `018-project-cart-generation`.
- Active feature pointer: `.specify/feature.json` points to `specs/018-project-cart-generation`.
- Existing generated storefront HTTP client interceptor behavior remains intact.

## Implementation Validation Flow

1. Update generated source layout and initial source generator.
   - Verify generated files include auth provider, cart provider, cart selection state, cart route, checkout route, product detail route, header, and cart item component.

2. Update init and runtime prompts.
   - Verify prompts no longer instruct cart scaffold or "coming soon" cart behavior.
   - Verify prompts require model selection before add/update.
   - Verify prompts require `store_cart`, selected model id, provider order, and shared HTTP client.

3. Add or update source/prompt contract tests.
   - Verify root provider order is `Providers -> StoreProvider -> AuthProvider -> CartProvider`.
   - Verify product detail source has disabled add/update before selected model exists.
   - Verify cart route source supports empty state, item checkbox selection, select all, selected summary, and checkout with `method=cart`.
   - Verify CartProvider source exposes cart, items, totalItems, isLoading, mode, add/update/remove/clear, and getItemQuantity.
   - Verify source/prompt text does not keep old "empty scaffold" cart instructions.

4. Validate generated API usage policy.
   - Verify profile and cart service calls use the shared generated HTTP client.
   - Verify no native fetch is introduced for customer/store APIs.
   - Verify account mutation response handling does not overwrite current UI state.

5. Run project validation.
   - `pnpm lint`

## Manual Generated Storefront Scenarios

1. Guest mode add/update:
   - Start generated storefront without a profile.
   - Open product detail.
   - Confirm no model is preselected and add action is disabled.
   - Select a model, add quantity 2, reload, and confirm `store_cart` preserves quantity 2.
   - Select same model, change to quantity 4, confirm cart quantity is 4.

2. Account mode load/mutation:
   - Start generated storefront with a valid profile.
   - Confirm cart loads page 1, limit 100 for current store.
   - Add, update, remove, and clear items.
   - Confirm UI changes immediately and does not wait for mutation responses.

3. Guest merge:
   - Create guest cart in `store_cart`.
   - Make profile available.
   - Confirm guest items are bulk merged before account cart display.
   - Confirm no bulk merge occurs when guest cart is empty.

4. Cart page selection:
   - Open cart page with multiple items.
   - Confirm default selection is empty.
   - Select one item and verify selected count/subtotal.
   - Toggle select all on/off.
   - Confirm checkout is disabled with no selection and enabled with selection.
   - Click checkout and confirm navigation includes `method=cart`.

5. Auth fallback:
   - Force unauthorized profile lookup.
   - Confirm credentials are cleared, profile is null, and cart runs in guest mode without an error message.

## Done Criteria

- Generated storefront cart placeholders are removed from relevant cart flows.
- Guest and account cart modes behave according to contracts.
- Product detail is the only add/update entry point.
- Cart page selection uses selected ids only.
- Header badge reflects total item quantity.
- `pnpm lint` passes.

## Implementation Notes

- Implemented in source generator, init prompt, runtime prompt, and API client policy scanner.
- Added source/prompt/policy contract tests for cart/auth generation.
- Added a Vitest-specific config so test runs do not load the TanStack Start dev plugin.
- Verified targeted cart/auth tests and full `pnpm lint` pass on 2026-05-28.
