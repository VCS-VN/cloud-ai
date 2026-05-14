export const storeKeys = [
  "id",
  "slug",
  "statusId",
  "userId",
  "name",
  "address",
  "phoneNumber",
  "placeId",
  "image",
  "metadata",
  "logo",
  "businessType",
  "postalCode",
  "setting",
] as const;

export const storeSettingKeys = [
  "isVerifiedProfile",
  "country",
  "currency",
  "paymentMethods",
] as const;

export const productKeys = [
  "note",
  "metadata",
  "isStockOption",
  "sortIndex",
  "thirdPartyPlatform",
  "descriptions",
  "reviewSummary",
  "thirdPartyId",
  "subImages",
  "createdAt",
  "hsCodeId",
  "defaultModel",
  "price",
  "nameAutocomplete",
  "isEnabledMonmi",
  "sku",
  "height",
  "updatedAt",
  "onlinePrice",
  "image",
  "models",
  "productOptions",
  "length",
  "weight",
  "entityId",
  "countries",
  "store",
  "storeId",
  "volume",
  "unit",
  "statusId",
  "hsCode",
  "defaultModelId",
  "name",
  "width",
  "businessType",
  "category",
  "pickupFees",
  "categoryId",
  "_score",
  "id",
] as const;

export const reviewSummaryKeys = ["reviewCount", "averageRating"] as const;

export const productModelKeys = [
  "onlinePrice",
  "image",
  "configs",
  "productId",
  "description",
  "weight",
  "originPrice",
  "thirdPartyPlatform",
  "storeId",
  "createdAt",
  "thirdPartyId",
  "isDefault",
  "price",
  "name",
  "id",
  "sku",
  "podId",
  "updatedAt",
  "status",
] as const;

export const productStoreSnapshotKeys = [
  "country",
  "address",
  "isDomesticShipping",
  "postalCode",
  "name",
  "isInternationalShipping",
  "id",
  "slug",
  "setting",
] as const;

export const productStoreSnapshotSettingKeys = ["country", "currency"] as const;

export const categoryKeys = ["name", "id"] as const;

export const productsListKeys = ["total", "data"] as const;
