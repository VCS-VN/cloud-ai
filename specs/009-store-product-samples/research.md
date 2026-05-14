# Research: Store and Product Sample Data

## Decision: Preserve exact user-provided structures

**Decision**: Store, Product, ProductsList, nested ProductModel, embedded StoreSnapshot, ReviewSummary, and Category structures are fixed. AI Agentic may change values but must not add, remove, rename, or reshape fields.

**Rationale**: The feature exists so AI Agentic understands project sample data. If the structure changes during prompt updates, generated pages and provider consumers become unsafe.

**Alternatives considered**:
- Flexible generated schema: rejected because it permits prompt drift.
- Minimal ecommerce model: rejected because user supplied full target structure.

## Decision: Initialize sample data after pages and components

**Decision**: Generate sample Store, one primary Product shape, and ProductsList only after pages and components are created during project initialization.

**Rationale**: StoreProvider already exists but lacks data. Running after page/component creation lets AI Agentic wire generated views to shared sample data instead of unrelated placeholders.

**Alternatives considered**:
- Generate data before page/component creation: rejected because later page generation may ignore or overwrite data.
- Generate only on first preview: rejected because project files would remain incomplete.

## Decision: Product identity uses stable `id`

**Decision**: Product updates match by stable unique product `id` first. `entityId` must always equal `id`. `defaultModel.productId` and each `models[].productId` must equal product `id`.

**Rationale**: Product `name`, `slug`, and display fields may change from prompts. Stable ID prevents accidental edits to wrong products.

**Alternatives considered**:
- Match by name: rejected because names are editable and may duplicate.
- Match by slug: rejected because slug may be generated from editable names.

## Decision: Prompt updates require ambiguity check

**Decision**: If a user prompt has ambiguous target, ambiguous value, or multiple product matches, AI Agentic must ask clarification before changing sample data.

**Rationale**: Safe implementation favors no data loss and no wrong product edits.

**Alternatives considered**:
- Best-effort guessing: rejected because it can corrupt sample data.
- Apply all possible matches: rejected because broad edits are often unintended.

## Decision: ProductsList total mirrors data length

**Decision**: `productsList.total` must equal `productsList.data.length`. Each element in `productsList.data` must have the exact Product structure.

**Rationale**: Product list consumers depend on both total count and data array being consistent.

**Alternatives considered**:
- Let total be user-controlled: rejected because it can desync list display.
