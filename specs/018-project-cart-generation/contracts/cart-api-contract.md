# Cart API Contract

This contract documents generated storefront API usage. Backend implementation is assumed to already exist.

## Shared Rules

- All customer/store API requests use the generated shared HTTP client.
- All prices are integer cents.
- Cart item id means selected product model id.
- Account mutation responses are ignored for current UI state.
- Account mutation failures do not rollback current UI state and do not show an error notification.

## Profile

### Get shopper profile

`GET /api/v1/auth/profile`

Response:

```json
{
  "id": "user-id",
  "phoneNumber": "optional phone",
  "email": "optional email",
  "firstName": "optional first name",
  "lastName": "optional last name"
}
```

Unauthorized behavior:
- Clear auth credentials.
- Set profile to null.
- Continue in guest mode.
- Do not expose profile error in UI.

## Cart Load

### Get account cart

`GET /api/v1/carts`

Params:

```json
{
  "page": 1,
  "limit": 100,
  "storeId": "current-store-id"
}
```

Response shape:

```json
{
  "data": [
    {
      "store": {
        "id": "store-id",
        "name": "",
        "address": ""
      },
      "items": [
        {
          "id": "selected-model-id",
          "name": "selected model name",
          "image": "selected model image or product image",
          "product": {
            "id": "product-id",
            "name": "product name",
            "image": "product image"
          },
          "store": {
            "id": "store-id",
            "name": "",
            "address": ""
          },
          "quantity": 1,
          "price": 430
        }
      ]
    }
  ],
  "total": 1,
  "totalItems": 1
}
```

Rules:
- `total` is the number of cart groups in current loaded response.
- `totalItems` is the sum of item quantities.
- Guest mode stores and reads this same shape from `store_cart`.

## Cart Mutations

### Add selected model to cart

`POST /api/v1/carts`

Body:

```json
{
  "id": "selected-model-id",
  "quantity": 1
}
```

UI rule:
- If item exists, combine quantity.
- If item does not exist, create item from selected model, product, and store summary.

### Update selected model quantity

`PATCH /api/v1/carts/{id}`

Path:
- `id`: selected model id.

Body:

```json
{
  "quantity": 4
}
```

UI rule:
- Set quantity to provided value.
- If quantity is 0, remove item and use remove behavior.

### Remove selected model from cart

`DELETE /api/v1/carts/{id}`

Path:
- `id`: selected model id.

UI rule:
- Remove matching item from current store cart group.

### Clear current store cart

`DELETE /api/v1/carts/all`

Params:

```json
{
  "storeId": "current-store-id"
}
```

UI rule:
- Remove current store cart group.
- Recompute totals.
- Clear selected checkout item ids.

### Bulk merge guest items

`POST /api/v1/carts/items/bulk`

Body:

```json
{
  "items": [
    {
      "itemId": "selected-model-id",
      "quantity": 1
    }
  ]
}
```

Rules:
- Only call when guest cart has at least one item.
- After successful merge, load account cart and clear guest cart storage.
- If guest cart has no items, skip merge and load account cart.
