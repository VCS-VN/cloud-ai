# Contract — Progress events vocabulary + privacy filter

**Date**: 2026-06-07 · **Plan**: [../plan.md](../plan.md)

The chat surfaces three layers of progress (γ + α + β-lite). Every layer MUST satisfy the privacy guarantee FR-007: zero file paths, file extensions, code identifiers, framework names, or code snippets visible to the user. This contract is the source of truth for what each layer emits and how the privacy filter validates it.

---

## Layer α — Phase labels (deterministic, hardcoded)

`phaseLabel(phase, locale)` returns a short user-facing string for every codex builder phase.

| Phase | locale `vi` | locale `en` |
|---|---|---|
| `loading_context` | "Đang đọc cấu trúc trang" | "Reading page structure" |
| `planning` | "Đang lên kế hoạch chỉnh sửa" | "Planning the edit" |
| `creating_draft` | "Đang chuẩn bị bản nháp" | "Preparing draft workspace" |
| `building_pages` | "Đang dựng các trang/khối" | "Building pages and sections" |
| `checking_preview` | "Đang kiểm tra preview" | "Checking the preview" |
| `repairing` | "Đang tự sửa các lỗi nhỏ" | "Self-healing small errors" |
| `publishing` | "Đang lưu thay đổi" | "Publishing changes" |
| `awaiting_clarification` | "Đang chờ bạn xác nhận lựa chọn" | "Waiting for your selection" |
| `done` | "Hoàn tất" | "Done" |
| `failed` | "Đã xảy ra lỗi" | "An error occurred" |
| `cancelled` | "Đã huỷ" | "Cancelled" |

Strings MUST NOT contain branded framework tokens; the table is the entire vocabulary.

---

## Layer γ — File-to-section mapping

`fileChangeToSection(filePath: string, locale): string | null` translates a raw file path emitted by the codex thread (`Turn.items[].type === "file_change"`) into a user-facing section label.

| Input pattern | Output (locale `vi`) | Output (locale `en`) |
|---|---|---|
| `src/routes/index.tsx` | "trang chủ" | "the home page" |
| `src/routes/products/index.tsx` | "trang danh sách sản phẩm" | "the products page" |
| `src/routes/products/$productId.tsx` | "trang chi tiết sản phẩm" | "the product detail page" |
| `src/routes/cart.tsx` | "trang giỏ hàng" | "the cart page" |
| `src/routes/checkout.tsx` | "trang thanh toán" | "the checkout page" |
| `src/routes/__root.tsx` | "khung chung của site" | "the global frame" |
| `src/components/storefront/Hero.*` | "phần hero" | "the hero section" |
| `src/components/storefront/ProductCard.*` | "khối sản phẩm" | "the product tile" |
| `src/components/storefront/ProductGrid.*` | "khu sản phẩm" | "the product grid" |
| `src/components/storefront/Header.*` | "phần đầu trang" | "the header" |
| `src/components/storefront/Footer.*` | "phần chân trang" | "the footer" |
| `src/components/storefront/CartDrawer.*` | "ngăn kéo giỏ hàng" | "the cart drawer" |
| `src/components/storefront/Banner.*` / `Promo.*` | "banner khuyến mãi" | "the promo banner" |
| `src/styles/app.css` | "hệ thống thiết kế" | "the design system" |
| `DESIGN.md` | "hệ thống thiết kế" | "the design system" |
| anything under `src/components/...` | "một phần của giao diện" | "a UI section" |
| (any other path) | `null` (suppress) | `null` |

When `null` is returned, the translator does NOT emit a `skeleton.update`. This keeps unmapped paths from leaking via fallback strings.

The mapping table lives at `src/server/functions/progress-mapper.server.ts` and is unit-tested per row.

### Output framing

Generated user-facing string is always `"Đang cập nhật {section}"` (vi) or `"Updating {section}"` (en). Multi-file batches dedupe sections; if 3 files map to the same section, only one event is emitted per phase tick.

---

## Layer β-lite — Final summary

`extractSummary(turnFinalResponse, locale): string` produces a single-line, ≤ 400-char summary of what the agent did. Steps:

1. Take the first paragraph of `Turn.finalResponse`.
2. Run the privacy filter (below).
3. If the filter rejects the candidate (any flag triggers), fall back to a phase-default sentence: `"Đã hoàn tất yêu cầu của bạn."` (vi) or `"Done with your request."` (en).
4. Truncate at 400 chars.

The β-lite summary is persisted as `Message{ kind: "answer" }`.

---

## Privacy filter

The filter (`isPrivacySafe(text): boolean`) returns `false` if any of these patterns matches:

- File path with extension: `/[\w./-]+\.(tsx?|jsx?|css|scss|json|md|sql|sh|ya?ml)/i`
- Multi-segment path: `/(?:^|\s|`)[\w-]+\/[\w./-]+/`
- Code-identifier-adjacent backticks: `/`[\w_$]{3,}`/`
- Code fence start: `/```/`
- HTML/JSX-like tag: `/<\/?[A-Za-z][\w-]*(\s|>|\/)/`
- Known framework or tooling tokens (case-insensitive): `tsx`, `jsx`, `vite`, `tanstack`, `drizzle`, `eslint`, `prettier`, `pnpm`, `npm`, `yarn`, `tailwind`, `react`, `node_modules`, `pm2`, `playwright`, `vitest`.

For internal-only output (e.g., raw codex turn text in audit logs), the filter is bypassed.

For user-facing output, ANY violation causes the candidate string to be replaced with the phase-default fallback.

### Tests

- Round-trip table: each γ row produces a privacy-safe output.
- Adversarial corpus: 50 synthetic strings containing file paths, identifiers, code fences MUST all be rejected by `isPrivacySafe`.
- Locale fallback: when β-lite extraction fails, output equals the phase-default for the active locale.

---

## Translator emission rules (Phase 1)

When the translator inside `MessageService.runOrchestrator` consumes a `BuilderRunEvent`:

1. `milestone` → emit `skeleton.update` with `{ phase: mapMilestoneToSkeleton(milestone), label: phaseLabel(milestone), detail: undefined }`.
2. `Turn.items[].file_change.path` → for each unique `section = fileChangeToSection(path)`, emit at most one `skeleton.update` per phase tick with `{ phase: "editing", label: "Đang cập nhật ${section}" }`. Skip when section is `null`.
3. `turn.completed` → run β-lite, then emit `message.created({ kind: "answer", content: summary })` followed by streamed `message.delta` chunks (split on whitespace boundaries, ≤ 60 chars per chunk to feel responsive) and finally `message.completed`.
4. `awaiting_clarification` → emit `message.created({ kind: "agent_question", metadata })` and `run.awaiting_input`.
5. `done` → emit `run.completed`.
6. `failed` → emit `run.failed` with friendly content built from the error mapping in `builder-runs.md`.
7. `cancelled` → emit `run.stopped`.

The translator NEVER passes raw codex text to the user without the privacy filter except inside `extractSummary` (which itself runs the filter).

---

## SSE replay (Phase 2)

When `/api/projects/$projectId/builder-runs/$runId/stream` opens:

1. Replay all events from `BuilderRunHandle.events` (in-memory) in order.
2. If the handle is missing but `agent_runs.progressTimeline` exists for that runId, synthesize replay events from the persisted timeline:
   - `milestone` → `BuilderRunEvent({ type: "milestone" })`
   - `section` → no replay (sections are decorative; transient)
   - `summary` → `message.completed` with the persisted text
   - `error` → `failed`
3. Subscribe live afterwards.

This keeps the chat replayable across reloads while honoring the transient nature of section progress.
