import type { Product, ProductsList, Store } from "./store-product-types";
import { validateProductShape, validateProductsListShape, validateStoreShape } from "./store-product-validation";

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneSampleData<T>(value: T): T {
  return structuredClone(value);
}

function mergeExistingShape(base: unknown, updates: unknown, path: string): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(updates)) throw new Error(`${path} must remain an array.`);
    return cloneSampleData(updates);
  }

  if (isRecord(base)) {
    if (!isRecord(updates)) throw new Error(`${path} must remain an object.`);
    const baseKeys = Object.keys(base);
    const updateKeys = Object.keys(updates);
    const allowed = new Set(baseKeys);

    for (const key of updateKeys) {
      if (!allowed.has(key)) throw new Error(`${path}.${key} is not allowed.`);
    }

    const merged: JsonObject = {};
    for (const key of baseKeys) {
      merged[key] = Object.prototype.hasOwnProperty.call(updates, key)
        ? mergeExistingShape(base[key], updates[key], `${path}.${key}`)
        : cloneSampleData(base[key]);
    }
    return merged;
  }

  if (isRecord(updates) || Array.isArray(updates)) {
    throw new Error(`${path} cannot change structure.`);
  }
  return cloneSampleData(updates);
}

export function mergeStoreValues(store: Store, updates: Partial<Store>): Store {
  const merged = mergeExistingShape(store, updates, "store") as Store;
  const validation = validateStoreShape(merged);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return merged;
}

export function mergeProductValues(product: Product, updates: Partial<Product>): Product {
  const merged = mergeExistingShape(product, updates, "product") as Product;
  const validation = validateProductShape(merged);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return merged;
}

export function mergeProductsListValues(
  productsList: ProductsList,
  updates: Partial<ProductsList>,
): ProductsList {
  const merged = mergeExistingShape(productsList, updates, "productsList") as ProductsList;
  const validation = validateProductsListShape(merged);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return merged;
}
