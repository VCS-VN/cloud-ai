# Phase 0 — Research: Storefront Lens System

**Date**: 2026-05-29
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Decisions**: [grilling-decisions.md](./grilling-decisions.md)

Mục tiêu của Phase 0 là gỡ các unknown trong Technical Context và chốt best-practice cho các nhánh quan trọng (signal-first variance, AI ranking, atomic write, telemetry sink). Mỗi mục có format Decision / Rationale / Alternatives.

---

## R-001 — YAML loader cho asset templates

**Unknown trong Technical Context**: Repo chưa có loader YAML rõ ràng (grep `js-yaml`/`yaml` trong package.json/src không có hit). Block library, categories, vibe reference pool đều là YAML (D4, D24, D9b, D16).

**Decision**: Dùng `js-yaml` (`^4.x`) làm loader chính. Wrap qua một module `design/library-loader.server.ts` (hoặc đặt trong `block-composer.server.ts`) để parse một lần và cache trong process. Validate output với zod schema tương ứng (block library, categories, reference pool) ngay sau parse — fail fast nếu YAML sai.

**Rationale**:
- `js-yaml` là chuẩn de-facto, không ESM/CJS rắc rối, hỗ trợ schema safe (`SAFE_SCHEMA`) tránh prototype-pollution.
- Validate-after-parse với zod đảm bảo asset YAML và in-memory model luôn đồng bộ; lỗi YAML kịp dừng pipeline trước khi vào ranker.
- Cache process-level đủ vì asset là static (không hot-reload tại runtime).

**Alternatives**:
- `yaml` (eemeli) — feature-rich hơn (CST, comments) nhưng không cần ở phase này.
- Convert sang JSON — mất khả năng comment/diff thân thiện cho reviewer (TR-004 đòi hỏi quarterly human review), nên loại.
- Embedded TS const — dữ liệu sẽ trộn lẫn code, phá tách-biệt-asset.

---

## R-002 — Manifest schema enforcement (`blocks.json`)

**Unknown**: Strict schema cho `blocks.json` (D11) phải reusable giữa pipeline (write) và validator (read).

**Decision**: Dùng zod làm single source of truth. Định nghĩa `BlocksManifestSchema` trong `src/features/ai-agent/design/blocks-manifest.ts`, export cả schema lẫn type. Các path khác (validator, lazy migration, contract test) đều `parse`/`safeParse` qua schema này.

**Rationale**:
- Repo đã dùng zod ở chỗ khác (FR-015, design-token-schema). Duy nhất một schema → tránh drift.
- zod cho phép discriminated union nếu sau này manifest mở rộng theo intent.

**Alternatives**:
- JSON Schema thuần + Ajv: dùng được nhưng repo chưa có; thêm dependency mới mà không có ROI.
- Type-only TS (interface): không validate runtime; manifest là dữ liệu persisted nên runtime check là bắt buộc.

---

## R-003 — Atomic write giữa `DESIGN.md` và `blocks.json` (TR-001)

**Unknown**: Hai file phải đồng bộ; nếu fail giữa chừng, project rơi vào trạng thái lệch.

**Decision**: Apply pattern *write-temp + fsync + rename*, áp dụng theo thứ tự:
1. Compose toàn bộ nội dung trong-bộ-nhớ (DESIGN.md mới + manifest mới).
2. Validate đầy đủ (FR-015).
3. Ghi `blocks.json.tmp` rồi `rename` → `blocks.json`.
4. Ghi `DESIGN.md.tmp` rồi `rename` → `DESIGN.md`.
5. Trên startup hoặc trước intent kế tiếp, validator phát hiện mismatch (anchor giữa Section 1 ↔ manifest) thì đánh dấu needs-manual-review (TR-001 + D13).

**Rationale**:
- POSIX rename là atomic trên cùng filesystem, đủ để không bao giờ thấy file half-written.
- Đặt manifest trước DESIGN.md vì manifest là "source of truth" cho composition; nếu fail giữa hai bước, lần chạy kế tiếp vẫn đọc được manifest cũ + Section 1 cũ (consistent), hoặc manifest mới + Section 1 cũ (validator phát hiện).
- Không cần journal/2PC; project workspace là thư mục local, rủi ro multi-writer thấp (single agent worker trên project tại một thời điểm).

**Alternatives**:
- Lock file: phòng race, nhưng project lifecycle đảm bảo single-writer (Builder runtime đã có guard) — over-engineer.
- Single-file format (JSON gói cả Markdown): mất khả năng đọc/diff DESIGN.md độc lập.

---

## R-004 — Variant ranker: structured output, caching, temperature (TR-013/014/015)

**Unknown**: Cách yêu cầu LLM trả top-3 ổn định, cache prompt prefix, chọn temperature.

**Decision**:
- **Structured output**: dùng OpenAI tool-use với `response_format: json_schema` (hoặc tương đương) ép schema `{ ranked: [{ variantId, score, rationale }] }` đúng top-3. Schema cũng bằng zod để parse phía consumer.
- **Cache prefix**: split prompt thành (a) static prefix (block library entry + project signal + vibe + few-shot từ reference pool) và (b) dynamic suffix (`alreadyComposedBlocks[]`). Tận dụng prompt caching của provider khi static prefix giữ nguyên hash trong một lần init/redesign.
- **Temperature**: `temperature = 0.2` cho ranker (gần deterministic nhưng không cứng); seed-pick code-side là cơ chế đa dạng chính, ranker chỉ cần ổn định top-3.
- **Tiebreak**: nếu score sát nhau, score được round 2 chữ số rồi seed = `hash(projectId, designVersion, shakeRevision, blockId)` chọn 1.

**Rationale**:
- Structured output hạ rate JSON-parse-error xuống ~0; phù hợp validator strict.
- Tách static/dynamic giúp giảm token cost khi ranker chạy cho nhiều block trong cùng project.
- temperature thấp đảm bảo "rank top-3" không bị nhiễu lớn giữa các lần chạy với cùng input.

**Alternatives**:
- temperature = 0: quá cứng; khi reference pool/library cập nhật, phương sai giữa các project có thể giảm bất thường.
- Free-form text + regex parse: brittle, đã loại theo TR-013.
- Embedding similarity tự code: out of scope (đã đẩy vào parking lot).

---

## R-005 — Seed hash algorithm

**Unknown**: Cách derive seed deterministic, không leak PII.

**Decision**: `seed = sha256(projectId + ':' + designVersion + ':' + shakeRevision)` (hex, 64 chars) và lưu trong manifest. Khi cần "child seed" cho từng block (D23 tiebreak), `blockSeed = sha256(seed + ':' + blockId)`. Dùng để index vào mảng top-3 bằng `parseInt(blockSeed.slice(0, 8), 16) % 3`.

**Rationale**:
- sha256 có sẵn trong Node `crypto`; không thêm dep.
- 64-char hex collision-free trong dải dùng nội bộ.
- Dùng `projectId` (UUID) đảm bảo không lộ user identity.

**Alternatives**:
- xxhash/MurmurHash: nhanh hơn nhưng không cần thiết; sha256 đủ rẻ với throughput pipeline.
- Random `Math.random` seeded: không deterministic theo `(designVersion, shakeRevision)`, vi phạm FR-014.

---

## R-006 — Telemetry sink (TR-010)

**Unknown**: Lưu event `design_generated` ở đâu (DB table riêng / external service / defer).

**Decision**: **Defer to hook-and-forget logger** ở phase MVP. Cụ thể:
- Module `design/telemetry.ts` expose `emitDesignGenerated(payload)` chỉ log structured (JSON line) qua logger hiện có (console-based ở dev, server-side log channel đã có ở prod).
- Không tạo DB table mới ở phase này; payload schema (zod) đã định nghĩa contract sau này có sink mới (DB / OpenTelemetry / external) chỉ cần thay implementation.

**Rationale**:
- Spec nói rõ telemetry P3 và TR-010 chưa chốt — không nên block MVP vì sink.
- Hợp với constitution IV (không over-engineer).
- Khi cần dashboards (SC-001 — variance baseline 30-day rolling), có thể bật sink DB trong feature follow-up mà không phải sửa caller.

**Alternatives**:
- Insert thẳng PostgreSQL ngay: vi phạm IX (yêu cầu `json` không `jsonb`) và over-engineer khi chưa biết shape báo cáo.
- External SaaS analytics: ràng buộc auth/secret, dội thêm scope.

---

## R-007 — Lazy migration trigger (TR-007)

**Unknown**: Detect-point cho migration project cũ (D18).

**Decision**: Đặt check ở entry của `design-pipeline.server.ts` (intent dispatcher). Trước khi route intent, gọi `lazyMigrateIfNeeded(projectWorkspace)`. Hàm này: (1) `existsSync(blocks.json)` → nếu đã có, return early; (2) nếu không, đọc DESIGN.md, suy composition (default rhythm), gọi vibe-author để re-author Section 1 (anchor = old vibe label theo TR-008), ghi atomic. Migration không tự ý bump `designVersion` — chỉ "khôi phục" trạng thái.

**Rationale**:
- Single point đảm bảo cả 5 intent đều được migrate trước khi xử lý.
- Tách thành module riêng (`lazy-migration.server.ts`) giúp test độc lập.
- Re-author Section 1 chứ không sinh lại token vì project cũ có thể đã được người dùng tinh chỉnh — giữ tokens stable.

**Alternatives**:
- Migrate batch một lượt khi deploy: rủi ro side-effect lên project chưa active; lazy an toàn hơn.
- Migrate chỉ khi intent != `update_no_design`: gây path branch lạ; thà migrate đồng nhất.

---

## R-008 — Required block "social-proof" group (D25, TR-018)

**Unknown**: Cách enforce "at-least-one" của nhóm social-proof mà không over-engineer.

**Decision**: Trong `block-library.yaml`, mỗi block trong nhóm social-proof khai báo `requirementGroup: social-proof`. Composer tải tất cả block có cùng group; sau khi compose, validator check `compositionContains(group: social-proof)` — nếu rỗng, composer lựa block-mặc-định (Trust signals) trước khi rerun validator. Nếu vẫn fail → mark needs-manual-review.

**Rationale**:
- Phù hợp với spec FR-006.
- Dữ liệu-driven: thêm group mới (urgency-signal, personalization) sau này chỉ cần cập nhật YAML + validator config (TR-018).

**Alternatives**:
- Hard-code "social-proof" trong code: phá tách asset/code, sửa phải redeploy.
- AI tự đảm bảo: không reproducible; dễ vi phạm FR-006.

---

## R-009 — Subcategory soft-vs-hard signal (D24, TR-017)

**Decision**: Trong `block-library.yaml`, một block được match theo subcategory với 3 trạng thái:
- Block không khai báo `applicableSubcategories`: match-all (boost theo primary category nếu có).
- Block khai báo list: chỉ boost rank khi project subcategory ∈ list, **không** loại block ra khỏi pool nếu không match.
- Project có subcategory không tồn tại trong taxonomy: composer dùng primary category fallback và log telemetry để bổ sung sau (TR-017).

**Rationale**: Subcategory dùng để tăng độ phù hợp, không phải gatekeeper — bảo toàn variance.

**Alternatives**: Hard filter theo subcategory → block library rỗng cho ngách không phổ biến, trái mục tiêu FR-003.

---

## R-010 — Skill artifact bump (D20, TR-012)

**Decision**:
- Edit `.agents/skills/storefront-design/SKILL.md` tại chỗ; bump frontmatter `version: 1.0.0` → `2.0.0`; thêm dòng compatibility tham chiếu pipeline mới (`design-generation-service.server.ts` + `design/`).
- Trước commit, `grep -rn "1\.0\.0" .agents/skills/storefront-design` để phát hiện hard-coded version reference khác.
- Skill body update: thêm Section "Block library + manifest" mô tả contract giữa skill (author DESIGN.md) và pipeline (compose blocks.json), giữ phần "Anti-template-leak" hiện tại.

**Rationale**: D20 chốt edit-in-place; bump major reflect breaking change về contract output (DESIGN.md Section 1 nay strict bullet structure, kèm manifest).

**Alternatives**: Tạo skill mới `storefront-design-v2`: khoá kép artifact đang được orchestrator lookup, gây drift.

---

## NEEDS CLARIFICATION resolution

| ID trong Technical Context | Trạng thái sau Phase 0 |
|---|---|
| YAML loader (R-001) | RESOLVED — `js-yaml` + zod validation |
| Telemetry sink (R-006) | RESOLVED — defer to logger; sink option để mở cho follow-up |

Không còn marker `NEEDS CLARIFICATION` nào treo cho Phase 1.

---

## Mapping tới quyết định grilling

| Tradeoff trong parking lot | Phase 0 quyết định liên quan |
|---|---|
| TR-001 atomic-write | R-003 |
| TR-007 lazy-migration-detection | R-007 |
| TR-008 legacy-vibe-label-to-anchor | R-007 |
| TR-010 analytics-store-decision | R-006 |
| TR-012 skill-version-bump-side-effects | R-010 |
| TR-013 rank-prompt-structured-output | R-004 |
| TR-014 rank-prompt-cache-prefix | R-004 |
| TR-015 rank-temperature-policy | R-004 |
| TR-016 categories-yaml-single-source | R-001 |
| TR-017 subcategory-soft-vs-hard | R-009 |
| TR-018 requirementGroup-extensibility | R-008 |

Các tradeoff còn lại (TR-002 fallback heuristic detail, TR-003 taxonomy-enrichment-reuse cache, TR-004 reference-pool maintenance cadence, TR-005 project-status-states UI, TR-006 heuristic fallback lookup, TR-009 migration Section 1 fallback, TR-011 variance baseline alert, TR-019 default position) thuộc về Phase 1 contract hoặc /speckit-tasks; được tham chiếu khi cần thiết.
