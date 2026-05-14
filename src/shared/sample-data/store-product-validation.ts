import type { Product, ProductsList, Store } from "./store-product-types";
import {
  categoryKeys,
  productKeys,
  productModelKeys,
  productsListKeys,
  productStoreSnapshotKeys,
  productStoreSnapshotSettingKeys,
  reviewSummaryKeys,
  storeKeys,
  storeSettingKeys,
} from "./store-product-shape";

export type SampleDataValidationResult = {
  valid: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushExactKeyErrors(
  errors: string[],
  value: unknown,
  expectedKeys: readonly string[],
  path: string,
) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  const expected = new Set(expectedKeys);
  const actualKeys = Object.keys(value);
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`${path}.${key} is required.`);
    }
  }
  for (const key of actualKeys) {
    if (!expected.has(key)) {
      errors.push(`${path}.${key} is not allowed.`);
    }
  }
}

export function validateStoreShape(store: unknown): SampleDataValidationResult {
  const errors: string[] = [];
  pushExactKeyErrors(errors, store, storeKeys, "store");

  if (isRecord(store)) {
    pushExactKeyErrors(errors, store.setting, storeSettingKeys, "store.setting");
    if (!isRecord(store.metadata)) errors.push("store.metadata must be an object.");
    if (isRecord(store.setting) && !Array.isArray(store.setting.paymentMethods)) {
      errors.push("store.setting.paymentMethods must be an array.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateProductShape(product: unknown, path = "product"): SampleDataValidationResult {
  const errors: string[] = [];
  pushExactKeyErrors(errors, product, productKeys, path);

  if (isRecord(product)) {
    pushExactKeyErrors(errors, product.reviewSummary, reviewSummaryKeys, `${path}.reviewSummary`);
    pushExactKeyErrors(errors, product.defaultModel, productModelKeys, `${path}.defaultModel`);
    pushExactKeyErrors(errors, product.store, productStoreSnapshotKeys, `${path}.store`);
    pushExactKeyErrors(errors, product.category, categoryKeys, `${path}.category`);

    if (!isRecord(product.metadata)) errors.push(`${path}.metadata must be an object.`);
    if (!Array.isArray(product.subImages)) errors.push(`${path}.subImages must be an array.`);
    if (!Array.isArray(product.models)) errors.push(`${path}.models must be an array.`);
    if (!Array.isArray(product.productOptions)) errors.push(`${path}.productOptions must be an array.`);
    if (!Array.isArray(product.countries)) errors.push(`${path}.countries must be an array.`);

    if (isRecord(product.store)) {
      pushExactKeyErrors(
        errors,
        product.store.setting,
        productStoreSnapshotSettingKeys,
        `${path}.store.setting`,
      );
    }

    if (Array.isArray(product.models)) {
      product.models.forEach((model, index) => {
        pushExactKeyErrors(errors, model, productModelKeys, `${path}.models.${index}`);
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateProductsListShape(productsList: unknown): SampleDataValidationResult {
  const errors: string[] = [];
  pushExactKeyErrors(errors, productsList, productsListKeys, "productsList");

  if (isRecord(productsList)) {
    if (!Array.isArray(productsList.data)) {
      errors.push("productsList.data must be an array.");
    } else {
      productsList.data.forEach((product, index) => {
        errors.push(...validateProductShape(product, `productsList.data.${index}`).errors);
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateProductInvariants(product: Product, path = "product"): SampleDataValidationResult {
  const errors: string[] = [];

  if (product.entityId !== product.id) errors.push(`${path}.entityId must equal ${path}.id.`);
  if (product.defaultModel.productId !== product.id) {
    errors.push(`${path}.defaultModel.productId must equal ${path}.id.`);
  }
  if (product.defaultModelId !== product.defaultModel.id) {
    errors.push(`${path}.defaultModelId must equal ${path}.defaultModel.id.`);
  }
  if (product.models.length === 0) errors.push(`${path}.models must contain at least one model.`);

  let hasDefaultModel = false;
  product.models.forEach((model, index) => {
    if (model.productId !== product.id) {
      errors.push(`${path}.models.${index}.productId must equal ${path}.id.`);
    }
    if (model.storeId !== product.storeId) {
      errors.push(`${path}.models.${index}.storeId must equal ${path}.storeId.`);
    }
    if (model.id === product.defaultModelId && model.isDefault) hasDefaultModel = true;
  });

  if (!hasDefaultModel) errors.push(`${path}.models must include the default model.`);

  return { valid: errors.length === 0, errors };
}

export function validateProductsListInvariants(productsList: ProductsList): SampleDataValidationResult {
  const errors: string[] = [];

  if (productsList.total !== productsList.data.length) {
    errors.push("productsList.total must equal productsList.data.length.");
  }

  const productIds = new Set<string>();
  productsList.data.forEach((product, index) => {
    if (productIds.has(product.id)) errors.push(`productsList.data.${index}.id must be unique.`);
    productIds.add(product.id);
    errors.push(...validateProductInvariants(product, `productsList.data.${index}`).errors);
  });

  return { valid: errors.length === 0, errors };
}

export function validateStore(store: Store): SampleDataValidationResult {
  return validateStoreShape(store);
}

export function validateProductsList(productsList: ProductsList): SampleDataValidationResult {
  const errors = [
    ...validateProductsListShape(productsList).errors,
    ...validateProductsListInvariants(productsList).errors,
  ];
  return { valid: errors.length === 0, errors };
}
