# Data Model: Project Cart Generation

## AuthProfile

Represents resolved shopper identity for generated storefront mode selection.

Fields:
- `id`: string, required.
- `phoneNumber`: string, optional.
- `email`: string, optional.
- `firstName`: string, optional.
- `lastName`: string, optional.

Validation:
- `id` must be present for authenticated mode.
- Missing profile means guest mode.

State transitions:
- `loading -> authenticated`: profile loads successfully.
- `loading -> guest`: no profile or unauthorized profile lookup.
- `authenticated -> guest`: logout clears profile and credentials.

## Cart

Represents the complete cart state shared by generated storefront UI.

Fields:
- `data`: CartGroup[].
- `total`: number; number of cart groups in current loaded cart response.
- `totalItems`: number; sum of all cart item quantities.

Validation:
- `total` must match `data.length` for guest mode after local mutations.
- `totalItems` must be recomputed after every local cart state change.
- Quantity values must not be negative.

## CartGroup

Represents cart items grouped under one store.

Fields:
- `store`: StoreSummary.
- `items`: CartItem[].

Validation:
- `store.id` must match the current generated storefront store when mutating current cart.
- Empty groups must be removed after item removal or clear.

## StoreSummary

Represents store display data inside a cart group and cart item.

Fields:
- `id`: string, required.
- `name`: string, required; empty string allowed when backend returns no display name.
- `address`: string, required; empty string allowed when backend returns no address.

## ProductSummary

Represents display data for the product that owns a selected model.

Fields:
- `id`: string, required.
- `name`: string, required.
- `image`: string, optional.

Validation:
- Image should use selected model image first, then product image fallback.

## CartItem

Represents one selected model line in the cart.

Fields:
- `id`: string; selected model id.
- `name`: string; selected model name or model id fallback.
- `image`: string, optional; selected model image with product image fallback.
- `product`: ProductSummary.
- `store`: StoreSummary.
- `quantity`: number.
- `price`: number; integer cents.

Validation:
- `id` is unique within a store cart group.
- Adding same `id` combines quantity.
- Updating existing `id` sets quantity to the new value.
- Quantity `0` removes the item.
- `price` remains integer cents and must not be pre-divided.

State transitions:
- `absent -> present`: add selected model with quantity > 0.
- `present -> present`: update selected model quantity > 0.
- `present -> absent`: remove item, clear cart, or update quantity to 0.

## CartContextState

Represents generated cart provider output.

Fields:
- `cart`: Cart.
- `items`: CartItem[]; flattened cart items.
- `totalItems`: number.
- `isLoading`: boolean.
- `mode`: `guest` or `user`.
- `addItem`: action for product detail.
- `updateItemQuantity`: action for quantity changes.
- `removeItem`: action for item removal.
- `clearCart`: action for current store clear.
- `getItemQuantity`: selector by selected model id.

Validation:
- Actions must update visible state before account persistence.
- Account persistence responses must not replace current state.
- Persistence failures must not rollback or notify shoppers.

## SelectedCartItemIds

Represents checkout preparation selection from cart page.

Fields:
- `ids`: string[]; selected cart item ids.

Validation:
- Defaults to empty.
- Select all uses currently visible cart item ids.
- Removed cart items must not remain selected in cart page UI.
- Checkout resolves details from `ids` plus current cart state.
