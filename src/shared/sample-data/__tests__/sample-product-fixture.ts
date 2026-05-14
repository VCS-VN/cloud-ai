import type { Product, ProductsList } from "../store-product-types";

export function createValidProduct(overrides: Partial<Product> = {}): Product {
  const productId = overrides.id ?? "fd30ec41-2910-4fb7-83cc-6c6f182c5e5e";
  const modelId = overrides.defaultModelId ?? "c1ab77a4-6e1b-40c3-a394-2bea20b080ff";
  const storeId = overrides.storeId ?? "d4884c98-0e0b-4dcd-9df4-8cab85053975";
  const defaultModel = {
    onlinePrice: 0,
    image: null,
    configs: [],
    productId,
    description: null,
    weight: 100,
    originPrice: 0,
    thirdPartyPlatform: null,
    storeId,
    createdAt: "2026-03-04T04:37:06.823Z",
    thirdPartyId: null,
    isDefault: true,
    price: 1200,
    name: "PIng abc",
    id: modelId,
    sku: "XP6A09WL3257JT1",
    podId: null,
    updatedAt: "2026-03-04T04:37:06.823Z",
    status: 1,
  };

  return {
    note: null,
    metadata: {},
    isStockOption: null,
    sortIndex: null,
    thirdPartyPlatform: null,
    descriptions: null,
    reviewSummary: { reviewCount: 0, averageRating: 0 },
    thirdPartyId: null,
    subImages: [],
    createdAt: "2026-03-04T04:37:06.764Z",
    hsCodeId: "5",
    defaultModel,
    price: 0,
    nameAutocomplete: "Hello world",
    isEnabledMonmi: false,
    sku: null,
    height: null,
    updatedAt: "2026-03-04T04:37:06.835Z",
    onlinePrice: null,
    image: "https://image-cdn.episcloud.com/01KJVJ4TCPHA7D01EK84T3AKWB.png",
    models: [defaultModel],
    productOptions: [],
    length: null,
    weight: null,
    entityId: productId,
    countries: ["AU"],
    store: {
      country: null,
      address: "200 Kent Street, Sydney NSW, Australia",
      isDomesticShipping: false,
      postalCode: "2000",
      name: "test2",
      isInternationalShipping: false,
      id: storeId,
      slug: "retail-topic*test2",
      setting: { country: "AU", currency: "AUD" },
    },
    storeId,
    volume: null,
    unit: null,
    statusId: 1,
    hsCode: "85171400",
    defaultModelId: modelId,
    name: "Hello world",
    width: null,
    businessType: "RETAIL",
    category: { name: "Other", id: "0cd86882-f411-4cce-b13d-791249fed078" },
    pickupFees: 30,
    categoryId: null,
    _score: null,
    id: productId,
    ...overrides,
  };
}

export function createValidProductsList(): ProductsList {
  return { total: 1, data: [createValidProduct()] };
}
