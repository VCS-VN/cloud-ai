---

Part 1: Variance Foundation (D1-D6)

D1 — Symptom diagnosis: Vấn đề cứng nhắc đến từ 3 nguồn: (a) page rhythm cố định, (c) vibe list bounded, (d)
component shape repertoire giống nhau giữa các project.

D2 — Variance source: Hybrid (d) — signal-first, randomness-as-tiebreaker. Seed = projectId.

D3 — Page rhythm variance: (b) optional blocks + (c) new block types. Constrained composition — một số block bắt
buộc, AI quyết định include/exclude optional + category-specific blocks.

D4 — Block library location: (c) templates/storefront/block-library.yaml. Tách khỏi skill, là asset của builder
pipeline.

D5 — Block schema: (b)+(c)+(d) full — eligibility signals (applicableCategories, applicableVibes, commerceGoal) +
composition rules (mustPrecede, mustFollow, mutuallyExclusive, maxOccurrences) + variant shapes (mỗi block có
nhiều variant với vibeAffinity).

D6 — Variant selection mechanism: (c) AI rank + (b) seed-pick. Tier theo block importance: high-impact blocks (AI
rank top 3 → seed chọn 1), supporting blocks (code filter → seed-pick thuần).

---

Part 2: Composition & Vibe Model (D7-D9, D24-D25)

D7 — High-impact vs supporting tier: (d) Hybrid — Hero + Feature band + category-specific blocks = high-impact
(AI rank). Header, Category strip, Product grid, Trust signals, Newsletter, Footer = supporting (seed-pick).

D8 — Vibe selection model: (c) Free-text descriptor + bounded anchors. AI sinh descriptor unique mỗi project, gắn
≥1 anchor từ bounded list (~12 vibes). Downstream dùng anchors để filter.

D9a — Anchor count: (b) 1-2 anchors per project.

D9b — Signal source cho descriptor: (b)+(c) Taxonomy enrichment (product subcategory, archetype, price tier) +
reference pool (few-shot examples tagged by category + anchors + anti-patterns).

D24 — Category taxonomy: (c) Two-tier primary (~20) + subcategory (~80-120). File canonical
templates/storefront/categories.yaml. Subcategory là soft signal (boost rank), không hard filter.

D25 — Required vs optional blocks: (d) Tier required system:

- Tier 1 (always): Header, Hero, Product grid, Footer
- Tier 2 (at-least-one from group): social-proof group (Trust signals / Press features / Founder note / Material
  sourcing — AI chọn dạng phù hợp brand)
- Optional: tất cả còn lại

---

Part 3: Lifecycle, Persistence & Reliability (D10-D13, D17-D18)

D10 — Intent model: (a)+(c) Conservative + shake_design. 5 intents:

- init — fresh DESIGN.md + blocks.json, seed = hash(projectId, designVersion, shakeRevision)
- update_token — patch token values only, không đổi composition/variant
- update_no_design — không đụng gì
- redesign — bump designVersion, fresh seed, full re-generate
- shake_design — bump shakeRevision, re-pick variant cho TẤT CẢ blocks, giữ vibe + tokens + block list

D11 — Persistence: (b) blocks.json cùng workspace với DESIGN.md. Format JSON. Schema:
{
"designVersion": 1,
"shakeRevision": 0,
"seed": "hash(projectId, designVersion, shakeRevision)",
"vibe": { "descriptor": "...", "anchors": ["retro", "minimalist"] },
"composition": [{ "blockId": "hero", "variantId": "editorial-overlay", "tier": "high-impact", "rankRationale":
"..." }]
}

D12 — shake_design semantics: (b) Re-pick variant cho TẤT CẢ blocks (cả supporting). Block list giữ nguyên. Vibe

- tokens giữ nguyên. Seed = hash(projectId, designVersion, shakeRevision) với shakeRevision bumped.

D13 — Validator rules: (e) Full validation — structural (blocks.json schema) + composition rules (mustPrecede,
mutuallyExclusive, required blocks) + cross-file consistency (anchors match giữa DESIGN.md Section 1 và
blocks.json) + vibe-variant affinity check.

D17 — Fallback strategy: (c) Per-failure-mode:

- Mode 1, 2 (taxonomy/vibe fail): retry + heuristic fallback (lookup table)
- Mode 3, 4, 5 (composition/affinity/cross-file fail): retry + mark needs-manual-review, không persist
- Mode 6 (JSON corrupt): retry once + throw (bug)

D18 — Migration: (a) Lazy migration on next intent. Detect missing blocks.json → infer composition từ existing
DESIGN.md + default rhythm + default variants → write blocks.json. Re-author Section 1 only (AI call, anchor =
old vibe label).

---

Part 4: Pipeline, Skill Artifact, Operations (D14-D16, D19-D23, D26)

D14 — Pipeline location: (d) Hybrid module:
src/features/ai-agent/
planning/
taxonomy-enrichment.server.ts (new)
design/ (new module)
design-generation-service.server.ts
block-composer.server.ts
variant-ranker.server.ts
vibe-author.server.ts
design-validator.server.ts
blocks-manifest.ts
templates/storefront/
block-library.yaml (new)
vibe-reference-pool.yaml (new)
categories.yaml (new)

D15 — DESIGN.md Section 1 format: (c) Strict bullet structure:

## 1. Visual Theme & Atmosphere

- **Descriptor:** 1970s analog warmth meets digital minimalism
- **Anchors:** retro, minimalist
- **Story:** [1-3 sentences elaborating vibe in commerce terms]

D16 — Reference pool shape: (c)+(d) Full tagging (anchors + applicableCategories) + anti-pattern examples. Format
YAML. Sourcing: AI-generated + human-reviewed.

D19 — Telemetry: (b) Variance metrics — cardinality vibe descriptors, distribution variant picks per high-impact
block, anchor combination distribution. Event design_generated với fields {projectId, vibeDescriptor, anchors[],
variantChoices[], category}.

D20 — Skill artifact update: (d) Edit SKILL.md in place + bump version 1.0.0 → 2.0.0 + update compatibility line.

D21 — Speckit integration: (b) Viết grilling-decisions.md làm intermediate artifact. Không động .specify/\* files,
không auto-trigger /speckit-specify.

D22 — Scope boundary: (b) Đào thêm 3 nhánh chiến lược (ranking prompt, taxonomy, required blocks) rồi stop.

D23 — Ranking prompt structure: (e) Full — composition awareness + top-3 ranking + seed tiebreak:
Input: block, variants, projectVibe, productCategory, customerArchetype, priceTier, alreadyComposedBlocks[]
Output: ranked[{ variantId, score(0-1), rationale }] top 3
Code dùng hash(projectId, designVersion, shakeRevision, blockId) chọn 1 trong top 3.

D26 — Output config: File path specs/019-storefront-lens-system/grilling-decisions.md, format Standard (~400-500
dòng), include Out-of-scope list.

---

Parking Lot — 19 Tradeoffs (TR-001 → TR-019)

┌────────┬─────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
│ ID │ Topic │ Summary │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-001 │ atomic-write │ blocks.json + DESIGN.md phải write transactional, detect │
│ │ │ mismatch on startup │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-002 │ validator-retry-fallback │ Heuristic fallback cho composition fail: skip optional, default │
│ │ │ rhythm + variant[0], hoặc mark needs-review │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-003 │ taxonomy-enrichment-reuse │ Output schema stable + cache khi nhiều consumer dùng │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-004 │ reference-pool-maintenance │ Static asset, cần quarterly review cadence + owner │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-005 │ project-status-states │ Thêm init_pending_review, init_failed + UI render + schema │
│ │ │ migration │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-006 │ heuristic-fallback-lookup │ category → defaultAnchor table, curate cùng cadence TR-004 │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-007 │ lazy-migration-detection │ existsSync(blocks.json) check ở entry point, │
│ │ │ migrateLegacyProject() module riêng │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-008 │ legacy-vibe-label-to-anchor │ Map 12 vibe labels → anchors (hầu hết 1-1) │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-009 │ migration-section1-failure │ Fallback descriptor = "<old-label> sensibility, refined", anchor │
│ │ │ = old label │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-010 │ analytics-store-decision │ DB table riêng vs external service vs defer │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-011 │ variance-baseline-target │ Alert nếu top-1 cluster > 25% share trong 30-day rolling (sau 50 │
│ │ │ projects) │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-012 │ skill-version-bump-side-effects │ Grep 1.0.0 references trước commit │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-013 │ rank-prompt-structured-output │ JSON schema enforcement via tool use / structured output API │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-014 │ rank-prompt-cache-prefix │ Prefix (project signal + vibe + library) trước, dynamic suffix │
│ │ │ (composedBlocks) sau │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-015 │ rank-temperature-policy │ temperature=0 hoặc 0.2, top_k seeding fallback │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-016 │ categories-yaml-single-source │ Canonical taxonomy, loader loadCategoryTaxonomy(), validator │
│ │ │ startup check │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-017 │ subcategory-soft-vs-hard │ Missing field = match all; explicit list = narrow. Edge case: │
│ │ │ unknown subcategory │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-018 │ requirementGroup-extensibility │ v1 chỉ social-proof với policy at-least-one. Future: │
│ │ │ urgency-signal, personalization │
├────────┼─────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ TR-019 │ page-rhythm-default-position │ Required tier 1 có defaultPosition cố định, optional flex │
└────────┴─────────────────────────────────┴──────────────────────────────────────────────────────────────────┘

---

Out of Scope (explicit)

- Prompt caching strategy (implementation detail → /speckit-plan)
- Ranking algorithm math / embedding similarity
- Accessibility (a11y)
- Internationalization (i18n)
- SEO impact of block reorder
- Performance budget for LLM calls
- UI design for project status states
- Deployment strategy
- Testing strategy (unit/integration/e2e)
- Seed hash algorithm implementation
