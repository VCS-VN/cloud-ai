# Data Model: Store and Product Sample Data

## Core Rule

AI Agentic may change sample data values from user prompts, but must not change object structure. No prompt may add, remove, rename, or reshape fields in Store, Product, ProductModel, StoreSnapshot, ReviewSummary, Category, or ProductsList.

## Store

### Required Shape

```json
{
  "id": "05cdd3e2-2e27-44f1-9d39-753814de06f9",
  "slug": "retail-topic*nail-studio",
  "statusId": 1,
  "userId": "user_01KH5D9KFP6MWHZ4ZC33KPK0DQ",
  "name": "Nail Studio",
  "address": "Chung cư cán bộ, nhân viên bộ tổng Tham Mưu, Đường Cầu Khoát, Tây Tựu, Từ Liêm, Hà Nội",
  "phoneNumber": "+8488040437",
  "placeId": "EzmaZl-NJIRggqqxm0AlnH1YhXqdVrPYY74vQLcIhZlgsRhY52Kr6WGtHHmnUaTVZpV6RJxyuKFM2xIzoFGB_HH-CG6tLC7_Neb2jWJ1tf_R4hwtQq50LnXqvIFCdCubd",
  "image": null,
  "metadata": {},
  "logo": null,
  "businessType": "RETAIL",
  "postalCode": "10000",
  "setting": {
    "isVerifiedProfile": false,
    "country": "VN",
    "currency": "AUD",
    "paymentMethods": []
  }
}
```

### Store Field Rules

| Field | Rule |
|-------|------|
| `id` | Stable unique store ID. User prompt may update value only when explicitly requested. |
| `slug` | Stable store slug. May change value only when user asks to change store slug or name-derived slug. |
| `statusId` | Numeric status value; keep field present. |
| `userId` | Owner ID value; keep field present. |
| `name` | Store display name. |
| `address` | Store address text. |
| `phoneNumber` | Store phone text. |
| `placeId` | External place identifier value; nullable only if existing structure permits null in implementation sample. |
| `image` | Store image URL or null. |
| `metadata` | Object field; keep as object even when empty. |
| `logo` | Store logo URL or null. |
| `businessType` | Business type string; default `RETAIL`. |
| `postalCode` | Postal code text. |
| `setting` | Nested object with fixed fields `isVerifiedProfile`, `country`, `currency`, `paymentMethods`. |
| `setting.paymentMethods` | Array field; keep as array even when empty. |

## Product

### Required Shape

Each product object must keep this full shape. `entityId` and `id` must always be the same value. Default sample generation should create at least 6 products by copying this structure and changing values safely.

```json
{
  "note": null,
  "metadata": {},
  "isStockOption": null,
  "sortIndex": null,
  "thirdPartyPlatform": null,
  "descriptions": null,
  "reviewSummary": {
    "reviewCount": 0,
    "averageRating": 0
  },
  "thirdPartyId": null,
  "subImages": [],
  "createdAt": "2026-03-04T04:37:06.764Z",
  "hsCodeId": "5",
  "defaultModel": {
    "onlinePrice": 0,
    "image": null,
    "configs": [],
    "productId": "fd30ec41-2910-4fb7-83cc-6c6f182c5e5e",
    "description": null,
    "weight": 100,
    "originPrice": 0,
    "thirdPartyPlatform": null,
    "storeId": "d4884c98-0e0b-4dcd-9df4-8cab85053975",
    "createdAt": "2026-03-04T04:37:06.823Z",
    "thirdPartyId": null,
    "isDefault": true,
    "price": 1200,
    "name": "PIng abc",
    "id": "c1ab77a4-6e1b-40c3-a394-2bea20b080ff",
    "sku": "XP6A09WL3257JT1",
    "podId": null,
    "updatedAt": "2026-03-04T04:37:06.823Z",
    "status": 1
  },
  "price": 0,
  "nameAutocomplete": "Hello world",
  "isEnabledMonmi": false,
  "sku": null,
  "height": null,
  "updatedAt": "2026-03-04T04:37:06.835Z",
  "onlinePrice": null,
  "image": "https://image-cdn.episcloud.com/01KJVJ4TCPHA7D01EK84T3AKWB.png",
  "models": [
    {
      "onlinePrice": 0,
      "image": null,
      "configs": [],
      "productId": "fd30ec41-2910-4fb7-83cc-6c6f182c5e5e",
      "description": null,
      "weight": 100,
      "originPrice": 0,
      "thirdPartyPlatform": null,
      "storeId": "d4884c98-0e0b-4dcd-9df4-8cab85053975",
      "createdAt": "2026-03-04T04:37:06.823Z",
      "thirdPartyId": null,
      "isDefault": true,
      "price": 1200,
      "name": "PIng abc",
      "id": "c1ab77a4-6e1b-40c3-a394-2bea20b080ff",
      "sku": "XP6A09WL3257JT1",
      "podId": null,
      "updatedAt": "2026-03-04T04:37:06.823Z",
      "status": 1
    }
  ],
  "productOptions": [],
  "length": null,
  "weight": null,
  "entityId": "fd30ec41-2910-4fb7-83cc-6c6f182c5e5e",
  "countries": ["AU"],
  "store": {
    "country": null,
    "address": "200 Kent Street, Sydney NSW, Australia",
    "isDomesticShipping": false,
    "postalCode": "2000",
    "name": "test2",
    "isInternationalShipping": false,
    "id": "d4884c98-0e0b-4dcd-9df4-8cab85053975",
    "slug": "retail-topic*test2",
    "setting": {
      "country": "AU",
      "currency": "AUD"
    }
  },
  "storeId": "d4884c98-0e0b-4dcd-9df4-8cab85053975",
  "volume": null,
  "unit": null,
  "statusId": 1,
  "hsCode": "85171400",
  "defaultModelId": "c1ab77a4-6e1b-40c3-a394-2bea20b080ff",
  "name": "Hello world",
  "width": null,
  "businessType": "RETAIL",
  "category": {
    "name": "Other",
    "id": "0cd86882-f411-4cce-b13d-791249fed078"
  },
  "pickupFees": 30,
  "categoryId": null,
  "_score": null,
  "id": "fd30ec41-2910-4fb7-83cc-6c6f182c5e5e"
}
```

### Product Field Rules

| Field Group | Rule |
|-------------|------|
| Product identity | `id` is stable unique product identity. `entityId` must equal `id`. |
| Store relationship | Top-level `storeId`, `defaultModel.storeId`, each `models[].storeId`, and embedded `store.id` must remain consistent with intended store snapshot. |
| Model relationship | `defaultModel.productId` and each `models[].productId` must equal product `id`. |
| Default model relationship | `defaultModelId` must equal `defaultModel.id`. One item in `models` must match `defaultModel.id` and have `isDefault: true`. |
| Review summary | `reviewSummary` always contains `reviewCount` and `averageRating`. |
| Category | `category` always contains `name` and `id`; `categoryId` remains present even when null. |
| Arrays | `subImages`, `models`, `productOptions`, and `countries` remain arrays. |
| Empty values | Existing nullable fields remain present with null when no value exists. |
| Search/display sync | `nameAutocomplete` should follow `name` unless user explicitly asks for different autocomplete value. |
| Prices | Product-level `price`, `onlinePrice`, model `price`, `onlinePrice`, and `originPrice` values may change, but fields remain present. |

## ProductModel

`defaultModel` and every item in `models` use this fixed shape:

```text
onlinePrice, image, configs, productId, description, weight, originPrice,
thirdPartyPlatform, storeId, createdAt, thirdPartyId, isDefault, price,
name, id, sku, podId, updatedAt, status
```

Rules:
- `configs` remains an array.
- `productId` equals parent product `id`.
- `storeId` equals parent product `storeId`.
- `defaultModel.id` equals parent product `defaultModelId`.
- At least one model exists in `models`.

## Embedded StoreSnapshot

Product `store` uses this fixed shape:

```text
country, address, isDomesticShipping, postalCode, name,
isInternationalShipping, id, slug, setting
```

Rules:
- `setting` contains only `country` and `currency`.
- Embedded store values are snapshot values for product display and must remain structurally smaller than the full Store object.

## ProductsList

### Required Shape

```json
{
  "total": 1,
  "data": [
    "<Product>"
  ]
}
```

Rules:
- `total` must equal `data.length` after every initialization or update.
- Each `data[]` element must have the exact Product shape.
- Default project initialization must generate at least 6 products.
- Adding products creates new unique product IDs, model IDs, and SKUs while preserving all fields.
- Removing products deletes only selected product records and updates `total`.
- Reordering products changes order only; product objects remain structurally unchanged.

## Validation Rules

1. Store object has exactly the Store keys and nested `setting` keys.
2. Each product object has exactly the Product keys and nested object keys documented here.
3. `product.entityId === product.id`.
4. `product.defaultModel.productId === product.id`.
5. Every `product.models[].productId === product.id`.
6. `product.defaultModelId === product.defaultModel.id`.
7. `productsList.total === productsList.data.length`.
8. Product IDs are unique within `productsList.data`.
9. Prompt updates must not change structure, only values or list membership/order.
10. Ambiguous prompt updates require clarification before data changes.

## State Transitions

```text
No sample data
  -> initialization creates Store + ProductsList with at least 6 Products
  -> prompt update changes values/list contents inside fixed structures
  -> validation passes before project files are considered updated
```
