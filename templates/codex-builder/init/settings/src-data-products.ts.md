---
target: src/data/products.ts
---
import type { Product } from "@/services/store/use-products-list";

export const products: Product[] = [
  {
    id: "sample-1",
    name: "Heritage Linen Shirt",
    descriptions:
      "<p>A breathable everyday shirt cut from <strong>washed linen</strong>. Designed for warm-weather comfort with a relaxed drape and natural texture that softens with every wash.</p><ul><li>100% washed European linen</li><li>Relaxed fit, mother-of-pearl buttons</li><li>Machine washable, quick-drying</li></ul>",
    image: "https://picsum.photos/seed/sample-1/600/600",
    images: ["https://picsum.photos/seed/sample-1/600/600"],
    category: { id: "cat-1", name: "Apparel" },
    price: 4999,
    compareAtPrice: 6999,
    defaultModel: { id: "sample-1-default", name: "Classic Fit", price: 4999 },
    models: [
      { id: "sample-1-default", name: "Classic Fit", price: 4999 },
      { id: "sample-1-relaxed", name: "Relaxed Fit", price: 5299 },
    ],
  },
  {
    id: "sample-2",
    name: "Artisan Ceramic Mug",
    descriptions:
      "<p>Hand-thrown stoneware mug finished with a matte glaze. Each piece carries the maker's mark, so no two are exactly alike.</p><p><strong>Care:</strong> dishwasher and microwave safe.</p>",
    image: "https://picsum.photos/seed/sample-2/600/600",
    images: ["https://picsum.photos/seed/sample-2/600/600"],
    category: { id: "cat-2", name: "Home Goods" },
    price: 2899,
    defaultModel: { id: "sample-2-default", name: "12 oz", price: 2899 },
    models: [
      { id: "sample-2-default", name: "12 oz", price: 2899 },
      { id: "sample-2-large", name: "16 oz", price: 3299 },
    ],
  },
  {
    id: "sample-3",
    name: "Organic Cotton Tee",
    descriptions:
      "<p>A wardrobe staple made from <strong>GOTS-certified organic cotton</strong>. Pre-shrunk and garment-dyed for a lived-in feel from the first wear.</p><ul><li>180 GSM organic cotton jersey</li><li>Reinforced collar, side-seamed</li><li>Available in six seasonal colors</li></ul>",
    image: "https://picsum.photos/seed/sample-3/600/600",
    images: ["https://picsum.photos/seed/sample-3/600/600"],
    category: { id: "cat-1", name: "Apparel" },
    price: 3499,
    defaultModel: { id: "sample-3-default", name: "Regular", price: 3499 },
    models: [
      { id: "sample-3-default", name: "Regular", price: 3499 },
      { id: "sample-3-tall", name: "Tall", price: 3799 },
    ],
  },
  {
    id: "sample-4",
    name: "Handwoven Tote Bag",
    descriptions:
      "<p>Roomy market tote woven from natural jute with cotton webbing handles. Sturdy enough for groceries, soft enough to fold into a pocket.</p><p>Dimensions: 40 × 38 × 14 cm.</p>",
    image: "https://picsum.photos/seed/sample-4/600/600",
    images: ["https://picsum.photos/seed/sample-4/600/600"],
    category: { id: "cat-2", name: "Home Goods" },
    price: 4299,
    defaultModel: { id: "sample-4-default", name: "Standard", price: 4299 },
    models: [{ id: "sample-4-default", name: "Standard", price: 4299 }],
  },
  {
    id: "sample-5",
    name: "Selvedge Denim Jeans",
    descriptions:
      "<p>Slim-straight jeans milled from <strong>13.5 oz Japanese selvedge denim</strong>. Raw and unwashed, they develop a personal fade pattern over months of wear.</p><ul><li>Sanforized to minimize shrinkage</li><li>Chain-stitched hem</li><li>Five-pocket construction</li></ul>",
    image: "https://picsum.photos/seed/sample-5/600/600",
    images: ["https://picsum.photos/seed/sample-5/600/600"],
    category: { id: "cat-1", name: "Apparel" },
    price: 11999,
    compareAtPrice: 13999,
    defaultModel: { id: "sample-5-default", name: "W31 L32", price: 11999 },
    models: [
      { id: "sample-5-default", name: "W31 L32", price: 11999 },
      { id: "sample-5-w32", name: "W32 L32", price: 11999 },
      { id: "sample-5-w33", name: "W33 L34", price: 12499 },
    ],
  },
  {
    id: "sample-6",
    name: "Beeswax Pillar Candle",
    descriptions:
      "<p>Slow-burning pillar candle poured from pure beeswax with a cotton wick. Burns clean with a faint honey scent and a warm amber glow.</p><p>Burn time: approximately 60 hours.</p>",
    image: "https://picsum.photos/seed/sample-6/600/600",
    images: ["https://picsum.photos/seed/sample-6/600/600"],
    category: { id: "cat-2", name: "Home Goods" },
    price: 1999,
    defaultModel: { id: "sample-6-default", name: "3 × 6 in", price: 1999 },
    models: [
      { id: "sample-6-default", name: "3 × 6 in", price: 1999 },
      { id: "sample-6-tall", name: "3 × 9 in", price: 2699 },
    ],
  },
  {
    id: "sample-7",
    name: "Merino Wool Beanie",
    descriptions:
      "<p>Lightweight ribbed beanie knit from <strong>extra-fine merino wool</strong>. Warm without bulk and itch-free against the skin.</p><ul><li>One size, stretches to fit</li><li>Naturally odor-resistant</li></ul>",
    image: "https://picsum.photos/seed/sample-7/600/600",
    images: ["https://picsum.photos/seed/sample-7/600/600"],
    category: { id: "cat-1", name: "Apparel" },
    price: 3799,
    defaultModel: { id: "sample-7-default", name: "One Size", price: 3799 },
    models: [{ id: "sample-7-default", name: "One Size", price: 3799 }],
  },
  {
    id: "sample-8",
    name: "Walnut Cutting Board",
    descriptions:
      "<p>End-grain cutting board crafted from solid American black walnut. The dense grain resists knife scarring and keeps edges sharp longer.</p><p><strong>Care:</strong> wipe with a damp cloth and re-oil monthly with food-safe mineral oil.</p>",
    image: "https://picsum.photos/seed/sample-8/600/600",
    images: ["https://picsum.photos/seed/sample-8/600/600"],
    category: { id: "cat-2", name: "Home Goods" },
    price: 6999,
    defaultModel: { id: "sample-8-default", name: "Medium", price: 6999 },
    models: [
      { id: "sample-8-default", name: "Medium", price: 6999 },
      { id: "sample-8-large", name: "Large", price: 8999 },
    ],
  },
];
