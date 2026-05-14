import type { ProductsList, Store } from "./store-product-types";
import { createSampleProductsList } from "./products-list-sample-factory";
import { createSampleStore } from "./store-sample-factory";
import { validateProductsList, validateStore } from "./store-product-validation";

export type StoreSampleInitResult = {
  store: Store;
  productsList: ProductsList;
};

export function initializeStoreSampleData(): StoreSampleInitResult {
  const store = createSampleStore();
  const productsList = createSampleProductsList();
  const storeValidation = validateStore(store);
  const productsListValidation = validateProductsList(productsList);
  const errors = [...storeValidation.errors, ...productsListValidation.errors];
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { store, productsList };
}
