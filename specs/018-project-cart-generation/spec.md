# Feature Specification: Project Cart Generation

**Feature Branch**: `018-project-cart-generation`  
**Created**: 2026-05-27  
**Status**: Draft  
**Input**: User description: "Generate AI Agent project-detail storefront cart behavior for guest and logged-in shoppers, replacing coming-soon cart placeholders with active cart state, profile-aware mode selection, local guest persistence, account cart persistence, product-detail add/update controls, cart selection, and checkout navigation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Cart From Product Detail (Priority: P1)

A shopper viewing a generated product detail page can select a product model, see the matching price and current cart quantity for that model, and add or update the cart without leaving the page.

**Why this priority**: Product detail is the only approved cart entry point, so this flow is required before cart page or checkout selection can provide value.

**Independent Test**: Generate a storefront with product models, open a product detail page, verify no model is preselected, select a model, add it to the cart, revisit the same model, and confirm the quantity is shown and updated instead of duplicated.

**Acceptance Scenarios**:

1. **Given** a product with one or more models, **When** the shopper opens product detail, **Then** no model is selected, the default price is displayed, and the cart action is unavailable until a model is selected.
2. **Given** the shopper selects a model not yet in the cart, **When** the shopper enters quantity 2 and confirms, **Then** the cart contains that model with quantity 2.
3. **Given** the selected model already exists in the cart with quantity 3, **When** the shopper changes quantity to 4 and confirms, **Then** the cart item quantity becomes 4 rather than 7.
4. **Given** the shopper changes a cart item quantity to 0, **When** the change is confirmed, **Then** the item is removed from the cart.

---

### User Story 2 - Preserve Guest and Account Cart Modes (Priority: P1)

A generated storefront chooses guest cart mode when no profile is available and account cart mode when a profile exists, while keeping one consistent cart experience for shoppers.

**Why this priority**: Guest and logged-in shoppers must both have a working cart, and the storefront must not lose guest cart choices when a shopper later becomes authenticated.

**Independent Test**: Use the generated storefront without a profile, add a cart item, reload the page, then make a profile available and verify the guest cart is merged into the account cart before the account cart is loaded.

**Acceptance Scenarios**:

1. **Given** no shopper profile is available, **When** the storefront initializes, **Then** it loads the guest cart from browser persistence and stores further cart changes there.
2. **Given** a shopper profile is available, **When** the storefront initializes, **Then** it loads the account cart for the current store after store and profile readiness are resolved.
3. **Given** a guest cart exists and the shopper becomes authenticated, **When** the account cart initializes, **Then** guest cart items are bulk-merged into the account cart before the account cart is shown.
4. **Given** no guest cart exists and the shopper becomes authenticated, **When** the account cart initializes, **Then** no bulk merge is attempted and the account cart loads normally.
5. **Given** authentication is invalid, **When** the profile lookup is rejected as unauthorized, **Then** stored authentication credentials are cleared, the profile is cleared, and the cart runs in guest mode.

---

### User Story 3 - Select Items In Cart For Checkout (Priority: P2)

A shopper on the generated cart page can choose specific cart items, see the selected total, and continue to checkout with the cart as the source.

**Why this priority**: The cart page must support selective checkout preparation without requiring the checkout feature to be completed in this phase.

**Independent Test**: Add multiple cart items, open the cart page, verify no items are selected by default, select individual items and all items, confirm the selected summary updates, and continue to checkout in cart-origin mode.

**Acceptance Scenarios**:

1. **Given** the cart has multiple items, **When** the shopper opens the cart page, **Then** no item is selected by default and the summary shows no selected total.
2. **Given** the shopper selects one item, **When** the cart summary updates, **Then** it reflects only the selected item quantity and subtotal.
3. **Given** visible cart items are present, **When** the shopper toggles select all, **Then** all visible items are selected; **When** the shopper toggles it again, **Then** all selected items are cleared.
4. **Given** at least one item is selected, **When** the shopper chooses checkout, **Then** checkout opens in cart-origin mode and can read the selected cart item identifiers.

---

### User Story 4 - Review Cart State Across Storefront Surfaces (Priority: P3)

A shopper sees cart status consistently in the generated header, cart page, and checkout preparation surfaces.

**Why this priority**: Consistent count, empty state, and selected totals help shoppers trust cart behavior after the core add/update flow is working.

**Independent Test**: Add, update, remove, and clear cart items, then verify the header count, cart page item list, and selected summary all reflect the same state.

**Acceptance Scenarios**:

1. **Given** the cart contains items, **When** the shopper views the site header, **Then** the cart icon shows the total item quantity as a badge.
2. **Given** the cart is empty, **When** the shopper opens the cart page, **Then** an empty cart state is shown with a way to continue shopping.
3. **Given** all cart items are cleared, **When** the cart page refreshes its local state, **Then** no item remains selected and totals return to zero.

### Edge Cases

- Cart persistence for an account shopper fails after the UI has already changed; the UI keeps the shopper's current cart state and does not show a save failure.
- A guest cart contains the same model more than once through repeated add actions; quantities are combined into one cart line for that model.
- A cart item is removed while selected for checkout; the selected item identifiers no longer include that item.
- The current store identity is not ready; cart loading and mutations wait until store identity is available.
- The profile lookup is still loading; cart loading waits until profile resolution completes.
- A product has no selected model; cart action remains unavailable even if a default model exists for price display.
- The cart has more account items than the initial page can load; the initial cart state includes the first 100 account items and reports totals from the account cart summary.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Generated project-detail storefronts MUST replace all cart "coming soon" behavior with active cart state and shopper-visible cart controls.
- **FR-002**: Generated storefronts MUST initialize store state first, profile state second, and cart state only after store and profile readiness are resolved.
- **FR-003**: Generated storefronts MUST determine cart mode from shopper profile availability: profile present means account mode; profile absent means guest mode.
- **FR-004**: Generated storefronts MUST provide a logout action that clears shopper profile state and authentication credentials.
- **FR-005**: Generated storefronts MUST clear profile state and authentication credentials when profile access is unauthorized, then continue in guest mode without exposing an error state to shoppers.
- **FR-006**: Guest cart mode MUST persist cart data in the shopper's browser using the same cart data shape as account mode.
- **FR-007**: Account cart mode MUST load the current store cart with page 1 and a limit of 100 items during initial cart setup.
- **FR-008**: When a shopper becomes authenticated and guest cart data exists, generated storefronts MUST bulk-merge guest cart items into the account cart before showing the account cart.
- **FR-009**: When no guest cart data exists during account cart setup, generated storefronts MUST skip bulk merge and load the account cart normally.
- **FR-010**: Generated storefronts MUST keep cart data in a shared state that includes grouped store cart data, a flattened item list, total item quantity, loading status, cart mode, and cart actions for add, update quantity, remove, and clear.
- **FR-011**: Cart totals MUST define `total` as the number of cart groups in the current cart response and `totalItems` as the sum of item quantities across the cart.
- **FR-012**: Product detail MUST be the only generated product surface that changes cart contents.
- **FR-013**: Product detail MUST NOT preselect a model, even when the product has a default model.
- **FR-014**: Product detail MUST display the default product price before model selection while requiring explicit model selection before add or update is available.
- **FR-015**: Product detail MUST show the current cart quantity for the selected model when that model already exists in the cart.
- **FR-016**: Adding the same selected model more than once MUST combine quantities into the existing cart line rather than create duplicate lines.
- **FR-017**: Updating an existing selected model from product detail MUST set the cart quantity to the displayed quantity rather than adding the displayed quantity to the previous quantity.
- **FR-018**: Setting a cart item quantity to 0 MUST remove the item from the cart.
- **FR-019**: Account cart changes MUST update the shopper-visible UI before persistence completes and MUST ignore persistence responses for the current UI state.
- **FR-020**: Account cart persistence failures MUST NOT roll back shopper-visible cart state and MUST NOT show an error notification.
- **FR-021**: Clear cart MUST remove the current store cart group, recompute totals, and clear selected checkout item identifiers.
- **FR-022**: The site header MUST show a cart badge only when total item quantity is greater than 0.
- **FR-023**: The cart page MUST render grouped cart items with product image, product name, selected model name, unit price, quantity controls, remove action, and item selection checkbox.
- **FR-024**: The cart page MUST start with no items selected for checkout.
- **FR-025**: The cart page MUST provide a select-all control that selects or clears all visible cart items.
- **FR-026**: The cart page summary MUST calculate selected item count and selected subtotal from selected item identifiers only.
- **FR-027**: The cart page checkout action MUST be unavailable when no items are selected.
- **FR-028**: The cart page checkout action MUST store selected cart item identifiers globally for checkout preparation and navigate to checkout in cart-origin mode.
- **FR-029**: Checkout preparation MUST derive selected item details from selected identifiers and current cart state rather than storing full selected item snapshots.
- **FR-030**: Generated storefront UI for cart, product detail, header badge, empty states, and checkout preparation MUST follow the generated project's design rules.
- **FR-031**: Generated cart drawer scaffolding MUST NOT become a required part of this feature unless a later request explicitly asks for drawer behavior.

### Key Entities *(include if feature involves data)*

- **Shopper Profile**: Represents an authenticated shopper. Key attributes include profile identifier and contact/name fields used only to determine authenticated cart mode and logout behavior.
- **Cart**: Represents the current shopper's cart for the storefront. Key attributes include store cart groups, total group count, and total item quantity.
- **Cart Group**: Represents cart items for a store. Key attributes include store identity, store name, store address, and cart items.
- **Cart Item**: Represents a selected product model in the cart. Key attributes include selected model identifier, selected model name, selected image, product summary, store summary, quantity, and unit price.
- **Product Model**: Represents the purchasable option selected on product detail. Its identifier is the cart item identity for add, update, remove, and merge behavior.
- **Selected Checkout Item Reference**: Represents an item selected on the cart page for checkout preparation. It stores only the cart item identifier and resolves details from current cart state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated product detail pages with product models prevent cart add or update until the shopper explicitly selects a model.
- **SC-002**: In generated storefront validation, guest shoppers can add an item, reload the page, and see the same cart item and quantity preserved.
- **SC-003**: In generated storefront validation, authenticated shoppers can add, update, remove, and clear cart items with visible UI updates occurring immediately after the shopper action.
- **SC-004**: In generated storefront validation, repeated adds of the same selected model result in one cart line with the combined quantity in 100% of tested cases.
- **SC-005**: In generated storefront validation, the cart page selected summary matches selected item quantities and subtotal in 100% of tested selection combinations.
- **SC-006**: In generated storefront validation, checkout cannot be started from the cart page until at least one item is selected.
- **SC-007**: In generated storefront validation, invalid authentication falls back to guest cart mode without blocking storefront browsing or cart use.
- **SC-008**: At least 95% of generated storefront cart flows complete primary cart actions without shoppers seeing placeholder "coming soon" cart messaging.

## Assumptions

- Existing store identity and shopper profile capabilities are available to generated storefronts.
- Existing account cart services support loading the current store cart, adding selected models, updating quantities, removing items, clearing the current store cart, and bulk-merging guest cart items.
- The account cart service accepts selected model identifiers as the item identity for add, update, remove, and bulk merge behavior.
- Guest and account cart data share the same user-facing shape so generated UI can render both modes without separate layouts.
- Guest cart persistence is scoped to the shopper's browser and is not intended to synchronize across devices.
- Checkout order creation and payment are outside this feature; checkout only receives selected cart item identifiers in cart-origin mode.
- Cart drawer behavior is outside this feature; header badge and cart route are sufficient for the requested generated storefront behavior.
