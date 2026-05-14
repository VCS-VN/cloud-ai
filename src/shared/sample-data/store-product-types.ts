export type StoreSetting = {
  isVerifiedProfile: boolean;
  country: string;
  currency: string;
  paymentMethods: unknown[];
};

export type Store = {
  id: string;
  slug: string;
  statusId: number;
  userId: string;
  name: string;
  address: string;
  phoneNumber: string;
  placeId: string | null;
  image: string | null;
  metadata: Record<string, unknown>;
  logo: string | null;
  businessType: string;
  postalCode: string;
  setting: StoreSetting;
};

export type ReviewSummary = {
  reviewCount: number;
  averageRating: number;
};

export type ProductModel = {
  onlinePrice: number;
  image: string | null;
  configs: unknown[];
  productId: string;
  description: string | null;
  weight: number;
  originPrice: number;
  thirdPartyPlatform: string | null;
  storeId: string;
  createdAt: string;
  thirdPartyId: string | null;
  isDefault: boolean;
  price: number;
  name: string;
  id: string;
  sku: string;
  podId: string | null;
  updatedAt: string;
  status: number;
};

export type ProductStoreSnapshot = {
  country: string | null;
  address: string;
  isDomesticShipping: boolean;
  postalCode: string;
  name: string;
  isInternationalShipping: boolean;
  id: string;
  slug: string;
  setting: {
    country: string;
    currency: string;
  };
};

export type Category = {
  name: string;
  id: string;
};

export type Product = {
  note: string | null;
  metadata: Record<string, unknown>;
  isStockOption: boolean | null;
  sortIndex: number | null;
  thirdPartyPlatform: string | null;
  descriptions: string | null;
  reviewSummary: ReviewSummary;
  thirdPartyId: string | null;
  subImages: string[];
  createdAt: string;
  hsCodeId: string;
  defaultModel: ProductModel;
  price: number;
  nameAutocomplete: string;
  isEnabledMonmi: boolean;
  sku: string | null;
  height: number | null;
  updatedAt: string;
  onlinePrice: number | null;
  image: string | null;
  models: ProductModel[];
  productOptions: unknown[];
  length: number | null;
  weight: number | null;
  entityId: string;
  countries: string[];
  store: ProductStoreSnapshot;
  storeId: string;
  volume: number | null;
  unit: string | null;
  statusId: number;
  hsCode: string;
  defaultModelId: string;
  name: string;
  width: number | null;
  businessType: string;
  category: Category;
  pickupFees: number;
  categoryId: string | null;
  _score: number | null;
  id: string;
};

export type ProductsList = {
  total: number;
  data: Product[];
};
