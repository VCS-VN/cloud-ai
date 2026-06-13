---
target: src/data/sample-store.ts
---
import type { StoreDetail } from "@/services/store/use-store-detail";

export const sampleStore: StoreDetail = {
  id: "sample-store",
  name: "Sample Store",
  slug: "sample-store",
  setting: { currency: "AUD" },
};
