import { createSampleModelId, createSampleProductId, createSampleSku } from "./sample-id-utils";
import type { Product } from "./store-product-types";
import { cloneSampleData } from "./store-product-update";
import { validateProductShape, validateProductInvariants } from "./store-product-validation";

type CreateSampleProductOptions = {
  index: number;
  name: string;
  price: number;
  image?: string | null;
  categoryName?: string;
};

const storeId = "05cdd3e2-2e27-44f1-9d39-753814de06f9";
const createdAt = "2026-03-04T04:37:06.764Z";
const modelCreatedAt = "2026-03-04T04:37:06.823Z";
const updatedAt = "2026-03-04T04:37:06.835Z";

export function createSampleProduct(options: CreateSampleProductOptions): Product {
  const productId = createSampleProductId(options.index);
  const modelId = createSampleModelId(options.index);
  const sku = createSampleSku(options.index);
  const categoryName = options.categoryName ?? "Nail Service";
  const model = {
    onlinePrice: 0,
    image: null,
    configs: [],
    productId,
    description: null,
    weight: 100,
    originPrice: 0,
    thirdPartyPlatform: null,
    storeId,
    createdAt: modelCreatedAt,
    thirdPartyId: null,
    isDefault: true,
    price: options.price,
    name: options.name,
    id: modelId,
    sku,
    podId: null,
    updatedAt: modelCreatedAt,
    status: 1,
  };

  const product: Product = {
    note: null,
    metadata: {},
    isStockOption: null,
    sortIndex: options.index,
    thirdPartyPlatform: null,
    descriptions: null,
    reviewSummary: { reviewCount: 0, averageRating: 0 },
    thirdPartyId: null,
    subImages: [],
    createdAt,
    hsCodeId: "5",
    defaultModel: model,
    price: 0,
    nameAutocomplete: options.name,
    isEnabledMonmi: false,
    sku: null,
    height: null,
    updatedAt,
    onlinePrice: null,
    image: options.image ?? "https://image-cdn.episcloud.com/01KJVJ4TCPHA7D01EK84T3AKWB.png",
    models: [model],
    productOptions: [],
    length: null,
    weight: null,
    entityId: productId,
    countries: ["AU"],
    store: {
      country: null,
      address:
        "Staff Quarters, General Staff Department, Cau Khoat Street, Tay Tuu, Tu Liem, Hanoi",
      isDomesticShipping: false,
      postalCode: "10000",
      name: "Nail Studio",
      isInternationalShipping: false,
      id: storeId,
      slug: "retail-topic*nail-studio",
      setting: { country: "VN", currency: "AUD" },
    },
    storeId,
    volume: null,
    unit: null,
    statusId: 1,
    hsCode: "85171400",
    defaultModelId: modelId,
    name: options.name,
    width: null,
    businessType: "RETAIL",
    category: { name: categoryName, id: "0cd86882-f411-4cce-b13d-791249fed078" },
    pickupFees: 30,
    categoryId: null,
    _score: null,
    id: productId,
  };

  const shapeValidation = validateProductShape(product);
  const invariantValidation = validateProductInvariants(product);
  const errors = [...shapeValidation.errors, ...invariantValidation.errors];
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return cloneSampleData(product);
}
