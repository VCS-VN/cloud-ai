---
rule: canonical-safe-access
---
SAFE DATA ACCESS:
- Treat optional chaining as the default for all hook/provider/API/route-param reads. Live payloads can be partial — even if TS marks a field required, code may run before the query resolves.
- Use `?.` at every nested level plus `??` fallback before any compute or render: `store?.name?.trim()`, `storeDetail?.setting?.currency ?? 'AUD'`, `product?.descriptions?.trim() ?? ''`, `product?.category?.name`, `product?.images?.[0]`, `product?.models?.[0]?.name`, `product?.models?.length ?? 0`, `(order?.items ?? [])`.
- Direct nested access (`product.name`, `product.category.name`) is allowed ONLY after a same-branch guard proves the parent exists. Product detail must return loading/error/missing-product UI before any product field read.
- Even after a guard, nullable children still use optional chaining: `product.category?.name`, `product.models ?? []`, `product.descriptions?.trim() ?? ''`.
- Normalize arrays before mapping/filtering/reducing/indexing: `const models = product?.models ?? []`, `const items = order?.items ?? []`. Never call `.map` / `.filter` / `.reduce` / `.length` / `[0]` on a maybe-undefined field without `?.` or `?? []`.
