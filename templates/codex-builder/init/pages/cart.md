---
layer: CART_PAGE
warning: >
  Route giỏ hàng. Spec hành vi (selection atom, checkout nav). Gửi nguyên văn.
---
src/routes/cart.tsx - createFileRoute('/cart'), active cart page using useCart() and selectedCartItemIdsAtom. Empty cart shows an empty state and Continue Shopping link. Non-empty cart groups/render items with checkbox, thumbnail, product name, selected model name, unit price, quantity controls, remove action, Clear all, Select all toggle, and selected subtotal/count summary. Default selection is empty. Checkout button disabled when no item selected and navigates to /checkout with search { method: 'cart' } when selected ids exist. Clear/remove must also clear removed ids from selectedCartItemIdsAtom. UI must follow DESIGN.md tokens.