import { createSampleProduct } from "./product-sample-factory";
import type { Product, ProductsList, Store } from "./store-product-types";
import { mergeProductValues, mergeStoreValues } from "./store-product-update";
import { validateProductsList } from "./store-product-validation";

export type StoreValueUpdatePlan = {
  type: "store.update";
  values: Partial<Store>;
};

export type ProductValueUpdatePlan = {
  type: "product.update";
  productId?: string;
  productName?: string;
  values: Partial<Product>;
};

export type ProductAddPlan = {
  type: "product.add";
  name: string;
  price: number;
  values?: Partial<Product>;
};

export type ProductRemovePlan = {
  type: "product.remove";
  productId?: string;
  productName?: string;
};

export type ProductsReorderPlan = {
  type: "products.reorder";
  productIds: string[];
};

export type SampleDataPromptUpdatePlan =
  | StoreValueUpdatePlan
  | ProductValueUpdatePlan
  | ProductAddPlan
  | ProductRemovePlan
  | ProductsReorderPlan;

export type SampleDataPromptUpdateInput = {
  store: Store;
  productsList: ProductsList;
  plan: SampleDataPromptUpdatePlan;
};

export type SampleDataPromptUpdateResult =
  | {
      status: "updated";
      store: Store;
      productsList: ProductsList;
    }
  | {
      status: "needs-clarification";
      reason: string;
      store: Store;
      productsList: ProductsList;
    };

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function findProductForPromptUpdate(
  productsList: ProductsList,
  target: { productId?: string; productName?: string },
) {
  if (target.productId) {
    const product = productsList.data.find((item) => item.id === target.productId);
    return product
      ? { status: "matched" as const, product }
      : { status: "needs-clarification" as const, reason: `No product found for id ${target.productId}.` };
  }

  if (!target.productName?.trim()) {
    return {
      status: "needs-clarification" as const,
      reason: "Product update requires a product id or unambiguous product name.",
    };
  }

  const matches = productsList.data.filter((product) => sameName(product.name, target.productName ?? ""));
  if (matches.length === 1) return { status: "matched" as const, product: matches[0] };
  if (matches.length > 1) {
    return {
      status: "needs-clarification" as const,
      reason: `Multiple products match ${target.productName}; provide product id.`,
    };
  }

  return {
    status: "needs-clarification" as const,
    reason: `No product found for name ${target.productName}; provide product id.`,
  };
}

function validateUpdatedProductsList(productsList: ProductsList) {
  const validation = validateProductsList(productsList);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return productsList;
}

function replaceProduct(productsList: ProductsList, nextProduct: Product): ProductsList {
  return validateUpdatedProductsList({
    total: productsList.data.length,
    data: productsList.data.map((product) => (product.id === nextProduct.id ? nextProduct : product)),
  });
}

function result(store: Store, productsList: ProductsList): SampleDataPromptUpdateResult {
  return { status: "updated", store, productsList: validateUpdatedProductsList(productsList) };
}

function clarification(
  reason: string,
  store: Store,
  productsList: ProductsList,
): SampleDataPromptUpdateResult {
  return { status: "needs-clarification", reason, store, productsList };
}

export function applySampleDataPromptUpdate({
  store,
  productsList,
  plan,
}: SampleDataPromptUpdateInput): SampleDataPromptUpdateResult {
  if (plan.type === "store.update") {
    return result(mergeStoreValues(store, plan.values), productsList);
  }

  if (plan.type === "product.update") {
    const match = findProductForPromptUpdate(productsList, plan);
    if (match.status === "needs-clarification") return clarification(match.reason, store, productsList);
    const updatedProduct = mergeProductValues(match.product, plan.values);
    return result(store, replaceProduct(productsList, updatedProduct));
  }

  if (plan.type === "product.add") {
    const product = mergeProductValues(
      createSampleProduct({ index: productsList.data.length, name: plan.name, price: plan.price }),
      plan.values ?? {},
    );
    const data = productsList.data.concat(product);
    return result(store, { total: data.length, data });
  }

  if (plan.type === "product.remove") {
    const match = findProductForPromptUpdate(productsList, plan);
    if (match.status === "needs-clarification") return clarification(match.reason, store, productsList);
    const data = productsList.data.filter((product) => product.id !== match.product.id);
    return result(store, { total: data.length, data });
  }

  const productById = new Map(productsList.data.map((product) => [product.id, product]));
  const hasAllProducts =
    plan.productIds.length === productsList.data.length &&
    plan.productIds.every((productId) => productById.has(productId));
  if (!hasAllProducts) {
    return clarification("Reorder requires every existing product id exactly once.", store, productsList);
  }
  return result(store, {
    total: productsList.data.length,
    data: plan.productIds.map((productId) => productById.get(productId) as Product),
  });
}
