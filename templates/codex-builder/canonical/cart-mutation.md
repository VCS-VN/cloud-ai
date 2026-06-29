---
rule: canonical-cart-mutation
---
CART MUTATION SURFACE:
- Product detail (`src/routes/products/$productId.tsx`) is the ONLY generated surface allowed to mutate cart state via `useCart()`.
- Product cards MUST link to product detail for option selection; they MUST NOT add to cart directly and MUST NOT call `toast` for add-to-cart.
- Cart item id is always the selected model id. Adding the same model id combines quantity. Updating an existing item SETS quantity (not "add more"). Quantity 0 removes the item (user mode calls `DELETE /api/v1/carts/${id}`).
- Cart selection (cart page) MUST use the Jotai `selectedCartItemIdsAtom` storing string ids ONLY, default empty array — never full item snapshots.
- Checkout is reached only via the cart page with explicit selection; navigate with `search: { method: 'cart' }` when at least one id is selected.
