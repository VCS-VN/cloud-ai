import { createSampleProduct } from "./product-sample-factory";
import type { ProductsList } from "./store-product-types";
import { cloneSampleData } from "./store-product-update";
import { validateProductsList } from "./store-product-validation";

const nailStudioProducts = [
  { name: "Classic Manicure", price: 1200 },
  { name: "Gel Polish Set", price: 1800 },
  { name: "Nail Art Detail", price: 700 },
  { name: "Spa Pedicure", price: 2200 },
  { name: "Acrylic Extension", price: 3200 },
  { name: "Cuticle Care Oil", price: 450 },
];

export function createSampleProductsList(): ProductsList {
  const data = nailStudioProducts.map((product, index) =>
    createSampleProduct({
      index,
      name: product.name,
      price: product.price,
    }),
  );
  const productsList = { total: data.length, data };
  const validation = validateProductsList(productsList);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return cloneSampleData(productsList);
}
