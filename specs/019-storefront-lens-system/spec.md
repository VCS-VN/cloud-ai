# Feature Specification: Storefront Lens System (Design Variance)

**Feature Branch**: `019-storefront-lens-system`
**Created**: 2026-05-29
**Status**: Draft
**Input**: User description: "Viết spec từ grilling-decisions.md (Storefront Lens System — variance foundation, block library, vibe model, lifecycle, validation, migration, telemetry)"

## User Scenarios & Testing *(mandatory)*

<!--
  Mỗi user story là một lát cắt giá trị độc lập, kiểm thử được riêng,
  ưu tiên theo P1 (quan trọng nhất) → P3.
-->

### User Story 1 - Sinh thiết kế storefront độc nhất khi khởi tạo project (Priority: P1)

Khi một project mới được khởi tạo, hệ thống tạo ra một bộ thiết kế storefront mang bản sắc riêng cho project đó: một vibe mô tả tự do (descriptor) gắn với anchor, một bố cục trang (composition) gồm các block phù hợp ngành hàng, và lựa chọn variant cho từng block. Kết quả ghi vào `DESIGN.md` (rule set) và một design manifest (`blocks.json`) đặt cùng workspace.

**Why this priority**: Đây là lý do tồn tại của feature — giải quyết vấn đề storefront giữa các project trông giống nhau (page rhythm cứng, vibe list bị bó, component shape lặp lại). Nếu chỉ làm story này, đã có một MVP tạo thiết kế đa dạng theo từng project.

**Independent Test**: Khởi tạo nhiều project khác ngành hàng và xác nhận mỗi project nhận được vibe descriptor khác nhau, composition khác nhau, và variant khác nhau; tất cả đều có đủ block bắt buộc và một manifest hợp lệ.

**Acceptance Scenarios**:

1. **Given** một project mới với prompt + website spec đã trích xuất, **When** chạy intent `init`, **Then** hệ thống ghi `DESIGN.md` (Section 1 theo cấu trúc bullet Descriptor/Anchors/Story) và `blocks.json` chứa `designVersion`, `shakeRevision`, `seed`, `vibe`, `composition`.
2. **Given** signal ngành hàng của project, **When** sinh vibe, **Then** descriptor là free-text độc nhất và được gắn 1-2 anchor từ danh sách anchor bị bó (~12).
3. **Given** composition được sinh, **When** kiểm tra, **Then** luôn có đủ Tier 1 (Header, Hero, Product grid, Footer) và ít nhất một block thuộc nhóm social-proof.
4. **Given** cùng signal, cùng `designVersion` và `shakeRevision`, **When** sinh lại, **Then** kết quả tái lập được (cùng seed → cùng lựa chọn).

---

### User Story 2 - Lắc lại thiết kế và làm lại toàn bộ (Priority: P2)

Người dùng muốn khám phá phương án thiết kế khác mà không phải bắt đầu lại từ đầu. `shake_design` giữ nguyên vibe, token và danh sách block nhưng chọn lại variant cho TẤT CẢ block. `redesign` làm mới hoàn toàn vibe + composition.

**Why this priority**: Mở rộng giá trị cốt lõi sang vòng lặp chỉnh sửa; cho phép thử biến thể một cách quyết định (deterministic) thay vì ngẫu nhiên không kiểm soát.

**Independent Test**: Trên một project đã init, chạy `shake_design` và xác nhận danh sách block + vibe + token không đổi nhưng tập variant đã đổi; chạy `redesign` và xác nhận `designVersion` tăng, vibe/composition mới.

**Acceptance Scenarios**:

1. **Given** project đã có manifest, **When** chạy `shake_design`, **Then** `shakeRevision` tăng, variant của mọi block được chọn lại, còn vibe + token + block list giữ nguyên.
2. **Given** project đã có manifest, **When** chạy `redesign`, **Then** `designVersion` tăng, seed mới, và toàn bộ vibe + composition được sinh lại.
3. **Given** intent `update_token`, **When** áp dụng, **Then** chỉ giá trị token thay đổi, composition và variant giữ nguyên.
4. **Given** intent `update_no_design`, **When** áp dụng, **Then** không file thiết kế nào bị thay đổi.

---

### User Story 3 - Di trú project cũ chưa có manifest (Priority: P3)

Project được tạo trước feature này chỉ có `DESIGN.md` mà không có `blocks.json`. Lần chạy intent kế tiếp, hệ thống tự suy ra composition và viết manifest, để project cũ tham gia được vào hệ thống mới mà không cần thao tác thủ công.

**Why this priority**: Bảo đảm tính tương thích ngược cho các project hiện hữu; cần thiết để rollout an toàn nhưng không chặn MVP.

**Independent Test**: Lấy một project chỉ có `DESIGN.md`, chạy một intent bất kỳ, xác nhận `blocks.json` được tạo với composition suy diễn và Section 1 được viết lại với anchor lấy từ nhãn vibe cũ.

**Acceptance Scenarios**:

1. **Given** project thiếu `blocks.json`, **When** chạy intent kế tiếp, **Then** hệ thống suy composition từ `DESIGN.md` + default rhythm + default variant rồi ghi manifest.
2. **Given** việc viết lại Section 1 thất bại, **When** fallback kích hoạt, **Then** descriptor mặc định = "<old-label> sensibility, refined" và anchor = nhãn vibe cũ.

---

### User Story 4 - Theo dõi độ đa dạng qua telemetry (Priority: P3)

Đội vận hành cần biết liệu hệ thống có thực sự sinh thiết kế đa dạng hay đang hội tụ về một vài mẫu giống nhau.

**Why this priority**: Bảo vệ mục tiêu cốt lõi (variance) bằng dữ liệu, nhưng không chặn việc sinh thiết kế.

**Independent Test**: Sinh thiết kế cho nhiều project và xác nhận có event `design_generated` ghi nhận đủ trường để tính phân bố vibe/variant/anchor.

**Acceptance Scenarios**:

1. **Given** một lần sinh thiết kế thành công, **When** quá trình hoàn tất, **Then** phát event `design_generated` với `{ projectId, vibeDescriptor, anchors[], variantChoices[], category }`.

---

### Edge Cases

- Subcategory thiếu hoặc không xác định: thiếu field = match-all; danh sách explicit thì thu hẹp; subcategory lạ được xử lý mềm (boost rank, không hard filter).
- Một block không có variant nào hợp lệ với vibe hiện tại → xử lý qua fallback heuristic thay vì sinh rỗng.
- Vi phạm composition (mustPrecede/mustFollow/mutuallyExclusive/maxOccurrences) hoặc thiếu block bắt buộc → validation báo lỗi, không persist.
- Anchor giữa `DESIGN.md` Section 1 và manifest không khớp → cross-file consistency fail.
- `blocks.json` hỏng/không parse được → retry một lần rồi báo lỗi (coi như bug).
- Di trú: viết lại Section 1 thất bại → dùng descriptor/anchor fallback từ nhãn cũ.

## Requirements *(mandatory)*

### Functional Requirements

**Variance & Signals**

- **FR-001**: Hệ thống MUST lấy variance từ signal trước (category, subcategory, archetype, price tier), chỉ dùng randomness có seed (seed gốc = projectId) làm tiebreaker.
- **FR-002**: Hệ thống MUST sinh vibe descriptor free-text độc nhất cho mỗi project và gắn 1-2 anchor từ danh sách anchor bị bó (~12 anchor).
- **FR-003**: Hệ thống MUST phân loại project theo taxonomy hai tầng: primary (~20) + subcategory (~80-120); subcategory là soft signal (boost rank), không hard filter.
- **FR-004**: Hệ thống MUST dùng một reference pool gắn tag (anchors + applicableCategories) kèm anti-pattern để dẫn hướng việc sinh descriptor (few-shot).

**Block Library & Composition**

- **FR-005**: Hệ thống MUST duy trì một block library mô tả cho mỗi block: eligibility signals (applicableCategories, applicableVibes, commerceGoal), composition rules (mustPrecede, mustFollow, mutuallyExclusive, maxOccurrences), và nhiều variant shape kèm vibeAffinity.
- **FR-006**: Hệ thống MUST áp dụng constrained composition: Tier 1 luôn có (Header, Hero, Product grid, Footer); Tier 2 ít nhất một block từ nhóm social-proof (Trust signals / Press features / Founder note / Material sourcing); các block còn lại là optional do AI quyết định include/exclude cùng block đặc thù ngành hàng.
- **FR-007**: Block Tier 1 bắt buộc MUST có defaultPosition cố định; block optional được đặt linh hoạt nhưng phải tuân composition rules.

**Variant Selection**

- **FR-008**: Với high-impact block (Hero, Feature band, block category-specific), hệ thống MUST để AI rank variant rồi seed-pick 1 trong top 3.
- **FR-009**: Với supporting block (Header, Category strip, Product grid, Trust signals, Newsletter, Footer), hệ thống MUST lọc variant hợp lệ bằng code rồi seed-pick thuần.
- **FR-010**: Việc rank variant MUST có composition awareness (xét các block đã compose) và trả về top-3 gồm `{ variantId, score(0-1), rationale }`.

**Persistence & Output Shape**

- **FR-011**: Hệ thống MUST ghi design manifest `blocks.json` cùng workspace với `DESIGN.md`, chứa `designVersion`, `shakeRevision`, `seed`, `vibe { descriptor, anchors[] }`, và `composition[] { blockId, variantId, tier, rankRationale }`.
- **FR-012**: `DESIGN.md` Section 1 (Visual Theme & Atmosphere) MUST theo cấu trúc bullet chặt: `Descriptor`, `Anchors`, `Story` (1-3 câu diễn giải vibe theo ngôn ngữ thương mại).

**Lifecycle Intents**

- **FR-013**: Hệ thống MUST hỗ trợ 5 intent với ngữ nghĩa:
  - `init`: tạo mới `DESIGN.md` + manifest; seed sinh từ project + designVersion + shakeRevision.
  - `update_token`: chỉ patch giá trị token, không đổi composition/variant.
  - `update_no_design`: không thay đổi gì.
  - `redesign`: tăng `designVersion`, seed mới, sinh lại toàn bộ.
  - `shake_design`: tăng `shakeRevision`, chọn lại variant cho TẤT CẢ block, giữ vibe + token + block list.
- **FR-014**: Với cùng đầu vào (signal, designVersion, shakeRevision), quá trình sinh MUST tái lập được (cùng seed → cùng lựa chọn variant/composition).

**Validation & Fallback**

- **FR-015**: Hệ thống MUST validate đầy đủ: structural (schema manifest) + composition rules (mustPrecede, mutuallyExclusive, required blocks) + cross-file consistency (anchor khớp giữa `DESIGN.md` Section 1 và manifest) + vibe-variant affinity.
- **FR-016**: Hệ thống MUST xử lý fallback theo từng failure mode:
  - Taxonomy/vibe fail → retry + heuristic fallback (lookup table category → defaultAnchor).
  - Composition/affinity/cross-file fail → retry + đánh dấu needs-manual-review, KHÔNG persist.
  - Manifest JSON hỏng → retry một lần rồi throw (coi là bug).

**Migration**

- **FR-017**: Hệ thống MUST lazy-migrate project cũ thiếu manifest ở intent kế tiếp: suy composition từ `DESIGN.md` + default rhythm + default variant, ghi manifest, và viết lại Section 1 (anchor = nhãn vibe cũ).
- **FR-018**: Khi viết lại Section 1 thất bại, hệ thống MUST dùng fallback descriptor "<old-label> sensibility, refined" với anchor = nhãn cũ.

**Telemetry**

- **FR-019**: Hệ thống MUST phát event `design_generated` với `{ projectId, intent, vibeDescriptor, anchors[], variantChoices[], category, designVersion, shakeRevision }` cho các intent thay đổi composition/vibe (`init`, `redesign`, `shake_design`). Intent `update_token` và `update_no_design` KHÔNG phát event này (token-patch service log riêng). Mục tiêu đo cardinality vibe, phân bố variant trên high-impact block, và phân bố tổ hợp anchor.

**Skill Artifact**

- **FR-020**: Skill artifact `storefront-design` MUST được cập nhật tại chỗ, bump version 1.0.0 → 2.0.0 và cập nhật dòng compatibility cho phù hợp pipeline mới.

### Key Entities *(include if feature involves data)*

- **Block**: Một mục trong block library; có eligibility signals, composition rules, và tập variant.
- **Variant**: Một hình thái cụ thể của block, kèm vibeAffinity.
- **Vibe**: `descriptor` (free-text độc nhất) + `anchors[]` (1-2 nhãn từ danh sách bị bó).
- **Anchor**: Nhãn vibe trong danh sách bị bó (~12), dùng để filter downstream.
- **Category Taxonomy**: Hai tầng primary (~20) + subcategory (~80-120); subcategory là soft signal.
- **Reference Pool**: Tập ví dụ gắn tag (anchors + applicableCategories) + anti-pattern, dùng few-shot; static asset (AI-generated + human-reviewed).
- **Design Manifest (`blocks.json`)**: Trạng thái version + composition của project, đặt cùng workspace với `DESIGN.md`.
- **DESIGN.md**: Rule set thiết kế per-project; Section 1 nắm giữ vibe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau 50 project, không một cluster thiết kế nào chiếm >25% share trong cửa sổ trượt 30 ngày (chuẩn variance).
- **SC-002**: 100% project sinh ra đều có đủ Tier 1 (Header, Hero, Product grid, Footer) và ít nhất một block social-proof.
- **SC-003**: Mỗi project nhận một vibe descriptor độc nhất; cardinality descriptor cao (gần như không trùng giữa các project khác ngành hàng).
- **SC-004**: 100% lần chạy `shake_design` cho ra tập variant khác trước trong khi vibe + token + block list giữ nguyên.
- **SC-005**: 100% lần chạy `redesign` cho ra composition/vibe khác và tái lập được với cùng seed mới.
- **SC-006**: 100% project cũ thiếu manifest được di trú thành công ở intent kế tiếp (tạo manifest hợp lệ + Section 1 hợp lệ), kể cả khi phải dùng fallback.
- **SC-007**: 0 project được persist với composition vi phạm rule; mọi trường hợp lỗi composition/affinity/cross-file đều bị đánh dấu needs-manual-review thay vì lưu.

## Assumptions

- Nơi lưu dữ liệu telemetry (DB table riêng vs external service vs defer) chưa chốt, hoãn sang `/speckit-plan` (TR-010).
- Thuật toán seed hash là chi tiết triển khai, nằm ngoài phạm vi spec.
- `requirementGroup` v1 chỉ gồm nhóm social-proof với policy at-least-one; urgency-signal/personalization để dành tương lai (TR-018).
- Reference pool là static asset cần review định kỳ (quarterly) và có owner (TR-004).
- Các hạng mục sau nằm ngoài phạm vi (theo decisions): prompt caching, toán học ranking / embedding similarity, accessibility (a11y), i18n, ảnh hưởng SEO khi reorder block, performance budget cho LLM call, UI cho project status states, deployment strategy, testing strategy.
- Việc bump version skill cần grep các tham chiếu "1.0.0" trước khi commit để tránh side-effect (TR-012).
