# Contract: Sample Data Initialization and Update

## Purpose

Define the behavior AI Agentic must follow when creating or updating sample Store, Product, and ProductsList data.

## Initialization Contract

### Input

- Generated project exists after pages and components are created.
- StoreProvider or equivalent shared store data wrapper exists.
- No sample store/product data has been generated for the project yet.

### Output

- One Store object with exact Store shape from `data-model.md`.
- One ProductsList object with shape `{ "total": number, "data": Product[] }`.
- At least 6 Product objects in `ProductsList.data`.
- All Product objects follow exact Product shape from `data-model.md`.
- Shared store provider exposes Store and ProductsList project-wide.

### Required Invariants

- `productsList.total === productsList.data.length`.
- Every product has unique `id`.
- Every product has `entityId === id`.
- Every product model uses parent product ID in `productId`.
- `defaultModelId === defaultModel.id`.

## Prompt Update Contract

### Allowed User Requests

- Update Store values such as `name`, `address`, `phoneNumber`, `logo`, `image`, `setting.currency`, or `setting.country`.
- Update Product values such as `name`, `image`, prices, category, status, countries, or model fields.
- Add new products using exact Product shape.
- Remove products by stable product `id` or unambiguous target.
- Reorder products.

### Forbidden Effects

- Add new fields.
- Remove fields.
- Rename fields.
- Change object nesting.
- Change arrays into objects or objects into arrays.
- Change `entityId` to differ from `id`.
- Leave `total` inconsistent with `data.length`.

### Ambiguity Rule

If a prompt does not clearly identify target product/store field or multiple products match, AI Agentic must ask a clarification question before changing data.

### Matching Rule

1. Match product by stable `id` first.
2. If no `id` is provided, match only when target is unambiguous from prompt context.
3. If multiple matches exist, ask clarification.

## Validation Contract

Before accepting generated or updated sample data, validation must check:

- Exact Store shape.
- Exact Product shape for each product.
- Exact ProductsList wrapper shape.
- Required relationship invariants from `data-model.md`.
- No duplicate product IDs.
- No structure change after prompt update.

## Error/Clarification Contract

When validation fails because the user prompt would change structure, AI Agentic should explain that structure is fixed and ask for a value-only update.

When validation fails because the target is ambiguous, AI Agentic should ask the user to provide product `id` or a clearer target.
