# Quickstart: Store and Product Sample Data

## Goal

Verify AI Agentic creates and updates sample Store, Product, and ProductsList data while preserving structure.

## Setup

1. Ensure active feature is `009-store-product-samples`.
2. Read `specs/009-store-product-samples/spec.md`.
3. Read `specs/009-store-product-samples/data-model.md`.
4. Read `specs/009-store-product-samples/contracts/sample-data-update-contract.md`.

## Initialization Verification

1. Start with a generated project after pages and components exist.
2. Run project initialization flow that creates sample data.
3. Verify Store exists and matches Store shape exactly.
4. Verify ProductsList exists with `total >= 6` and `data.length >= 6`.
5. Verify every `data[]` element matches Product shape exactly.
6. Verify shared store provider uses the generated Store and ProductsList.

## Prompt Update Verification

Use these prompts as acceptance examples:

- `Đổi tên store thành Nail Studio Premium`
- `Đổi giá product id fd30ec41-2910-4fb7-83cc-6c6f182c5e5e thành 1500`
- `Thêm 1 product mới tên Gel Polish Basic giá 900`
- `Xóa product id fd30ec41-2910-4fb7-83cc-6c6f182c5e5e`
- `Đổi sản phẩm Hello world thành màu đỏ` when multiple matches exist; expected result is clarification question before update.

## Required Checks

- `entityId` equals `id` for every product.
- `defaultModel.productId` equals parent product `id`.
- Every `models[].productId` equals parent product `id`.
- `defaultModelId` equals `defaultModel.id`.
- Product IDs are unique.
- `productsList.total` equals `productsList.data.length`.
- No object keys were added, removed, or renamed.

## Commands

```bash
pnpm test
pnpm typecheck
```

Use `pnpm lint` if tasks touch TypeScript files and project keeps lint alias as typecheck.
