# Implementation Plan: Builder UI Lumen Design Port

**Branch**: `029-builder-ui-lumen-port` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-builder-ui-lumen-port/spec.md`

## Summary

Replace builder UI identity entirely với design system Lumen do open-design.ai sinh ra cho client. Source of truth visual nằm ngoài repo tại folder Application Support; ba file CSS (`tokens.css`, `components.css`, `index.css`) và `tailwind.config.js` được port vào repo, sáu HTML preview chỉ làm reference. Triển khai chia bốn pull request tuần tự (PR1 tokens & config replacement, PR2 shadcn primitives + scaffold, PR3a tier 1 routes, PR3b tier 2 routes), mỗi PR được supervisor sub-agent (gate-guardian + spec-custodian) verify dựa trên constitution viết trước. Mọi UI primitive đi qua shadcn layer tại `src/components/ui/*` — feature/route code KHÔNG render `<button>`/`<input>`/`<dialog>` thô; primitives shadcn render class Lumen qua cva variants thay vì shadcn baseColor variables. Behavior change duy nhất ngoài visual: route `/` đảo logic (logged-out → `/auth/login`, logged-in → render trang home theo `new-project.html`); `/dashboard` drop `HomePromptForm`; post-login redirect mặc định là `/dashboard`.

## Technical Context

**Language/Version**: TypeScript 5.x với React 19, TanStack Router/Start.
**Primary Dependencies**: Tailwind CSS v3 (đã có), shadcn/ui CLI + Radix UI primitives (button/popover/command đã có; thêm khi cần), `class-variance-authority` (cva), `clsx`/`tailwind-merge` (qua `@/utils/cn` hiện hữu). PostCSS + autoprefixer (đã có). KHÔNG thêm dependency runtime mới.
**Storage**: N/A — feature này thuần frontend skinning.
**Testing**: Vitest unit (`pnpm test`) + contract test có sẵn `tests/contract/no-legacy-chat-path.contract.test.ts` (phải tiếp tục pass). Visual verification dựa eyeball trên `pnpm dev` URL — không setup Playwright/Chromatic trong scope.
**Target Platform**: Self-hosted Node.js 22+ runtime; browser modern evergreen.
**Project Type**: Single-repo web application — TanStack Router routes serve UI và `/api/...` chung.
**Performance Goals**: `pnpm build` exit 0 sau mỗi PR. `pnpm dev` ready trong dưới 30 giây. Không có performance regression test cho visual.
**Constraints**:
- Surgical changes (AGENTS.md mục 3): mỗi PR chỉ touch file thuộc scope đã khai báo trong constitution.
- Không thay đổi behavior codex SDK / builder run / plan classifier / repair loop / cancel controller / server functions / route loaders (trừ `/` đảo logic + `/dashboard` drop HomePromptForm).
- Không tạo path mới vào `@/features/ai-agent/agent/`, không recreate `@/server/services/message-service.ts`, không tái lập `/api/projects/$projectId/runs/`.
- Source of truth visual nằm NGOÀI repo: `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/`.
- Mọi UI primitive đi qua `src/components/ui/*`; cấm raw `<button>`/`<input>`/`<textarea>`/`<select>`/`<dialog>` trong feature/route code.
**Scale/Scope**: 11 route + ~5 layout/common component + ~3 ui primitive + 1 home component (HomePromptForm) + tailwind config + 3 file CSS mới + 1 file CSS xoá. Tổng ~25-30 file thay đổi qua 4 PR. Tier 1 PR3a tập trung 4 surface (`__root`, `/`, `/dashboard`, `/projects/$id`) trong đó `$projectId.tsx` 1467 dòng là file lớn nhất.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|-----------|------------|
| I. Yêu cầu rõ ràng code flow & tính năng | PASS — luồng port được tách bốn PR rõ scope; spec liệt kê file path và class mapping cho từng surface; constitution feature ghi rõ what touch / what cấm động. |
| II. Test cho mọi business rule quan trọng | PASS với caveat — feature này thuần visual, không thêm business rule. Test contract `no-legacy-chat-path` phải pass; `pnpm test` không có test mới fail. KHÔNG setup visual regression test (out of scope, ghi nhận trong Assumptions). |
| III. API trả lỗi nhất quán | N/A — không thêm/đổi API. |
| IV. Không over-engineer | PASS — không tạo abstraction mới (token loader, theme provider, design token registry). Bridge layer `--app-*` cũ bị xoá thay vì thay bằng layer khác. Không thêm build step generate CSS từ JSON. |
| V. UX đơn giản, Validation Client/Server & Design System Compliance | **CONFLICT có chủ ý** — Principle V hiện hành yêu cầu UI tuân `DESIGN.md`. Feature này quyết định bỏ `DESIGN.md` cho builder UI (chỉ giữ DESIGN.md cho storefront generated tại `templates/storefront/*/DESIGN.md`). Source of truth visual cho builder UI chuyển sang folder open-design ngoài repo + ba file CSS được port. Spirit của Principle V (cấm hardcode màu ngoài hệ thống token) vẫn được giữ vì mọi color đi qua `--color-*` của Lumen. Đề nghị bumping constitution lên 1.5.0 với clarification: "DESIGN.md áp dụng cho storefront generated; builder UI dùng design system check vào `app/styles/`." Việc bump không thực hiện trong feature này — ghi nhận follow-up TODO trong constitution.md sau PR3b. |
| VI. Bảo mật theo role/permission | PASS — không động auth flow ngoài đảo loader `/` (gated post-auth thay public landing) và post-login redirect target. Logic `getCurrentUser` server function không đổi. |
| VII. Code Review & Impact Analysis ưu tiên Graph | PASS — supervisor sub-agent đóng vai trò gate-guardian + spec-custodian cho từng PR; review tập trung scope creep và behavior preservation. Code-graph review không bắt buộc trong scope nhưng có thể chạy thủ công nếu user yêu cầu. |
| VIII. Chuẩn hóa Code Formatting | PASS — file CSS port giữ nguyên format của open-design (đã chuẩn 2-space + comment block). TSX refactor giữ format hiện hữu của repo (ESLint/Prettier config không đổi). |
| IX. Database JSON Type Convention | N/A — không động database. |
| X. Import Alias Convention | PASS — refactor giữ import alias `@/components/*`, `@/utils/*`, `@/features/*` hiện hữu. |

**Constitution amendment proposal**: Sau PR3b merge, đề nghị bump constitution lên 1.5.0 cập nhật Principle V: phân biệt scope DESIGN.md (storefront generated) vs design system check vào `app/styles/` (builder UI). Việc này thực hiện trong PR riêng theo `.specify/memory/constitution-update-checklist.md` (nếu có).

## Project Structure

### Documentation (this feature)

```text
specs/029-builder-ui-lumen-port/
├── plan.md              # This file
├── spec.md              # Already created
├── constitution.md      # Per-feature design-port constitution (PR0 deliverable)
├── checklists/
│   └── requirements.md  # Already created — passing
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
app/
└── styles/
    ├── tokens.css         # NEW — copy from open-design folder, RGB triplet vars
    ├── components.css     # NEW — copy from open-design folder, @layer components
    ├── index.css          # NEW — copy from open-design folder, entry import
    └── globals.css        # DELETED in PR1

src/
├── components/
│   ├── ui/                # shadcn primitives — internal class Lumen rewrite (PR2)
│   │   ├── button.tsx     # MODIFIED — cva variants render .btn .btn-primary etc.
│   │   ├── popover.tsx    # MODIFIED — bg-surface/border-hairline/rounded-card/shadow-card
│   │   ├── command.tsx    # MODIFIED — same Lumen surface tokens
│   │   ├── input.tsx      # NEW (if needed) — render .input
│   │   ├── textarea.tsx   # NEW (if needed) — render .textarea
│   │   └── ... (add via shadcn CLI khi route nào cần primitive chưa có)
│   ├── layout/
│   │   ├── AppSidebar.tsx       # MODIFIED — .topbar*, bg-paper, border-hairline (PR2)
│   │   └── WorkspaceShell.tsx   # MODIFIED — chrome theo dashboard.html (PR2)
│   ├── common/                  # MODIFIED — refactor token cũ → mới (PR2)
│   ├── home/
│   │   └── HomePromptForm.tsx   # MODIFIED — .composer + .btn-primary (PR3a)
│   └── auth/
│       └── LoginModal.tsx       # SOFT-RETIRED — không còn dùng ở `/` (xoá khỏi index.tsx; có thể xoá luôn nếu unreferenced sau PR3a)
├── routes/
│   ├── __root.tsx               # MODIFIED — chrome topbar Lumen (PR3a)
│   ├── index.tsx                # MODIFIED — đảo loader, render hero new-project.html (PR3a)
│   ├── dashboard/
│   │   └── index.tsx            # MODIFIED — drop HomePromptForm, layout dashboard.html (PR3a)
│   ├── projects/
│   │   ├── $projectId.tsx       # MODIFIED — walk-by-section, mixed mode (PR3a)
│   │   ├── index.tsx            # MODIFIED — derive từ dashboard.html chrome (PR3b)
│   │   └── starred.tsx          # MODIFIED — derive từ dashboard.html chrome (PR3b)
│   ├── auth/
│   │   ├── login.tsx            # MODIFIED — match login.html (PR3b)
│   │   └── callback.tsx         # MODIFIED — match callback.html (PR3b)
│   ├── settings/
│   │   ├── index.tsx            # MODIFIED — match settings.html (PR3b)
│   │   └── profile.tsx          # MODIFIED — derive từ settings.html chrome (PR3b)
│   └── user-guide.tsx           # MODIFIED — tokens-only swap (PR3b)
└── server/                      # KHÔNG động (trừ post-login redirect target)
    └── functions/
        └── auth.ts              # MODIFIED nhỏ nếu cần thay redirect mặc định sau callback (PR3a)

tailwind.config.ts                # REPLACED — port từ tailwind.config.js của open-design (PR1)
postcss.config.cjs                # CHECK & MERGE — đối chiếu với postcss.config.js của open-design (PR1)

tests/
└── contract/
    └── no-legacy-chat-path.contract.test.ts  # MUST PASS sau mỗi PR

# OUTSIDE REPO — design source of truth (read-only reference cho executor):
# ~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/
# ├── tokens.json             (KHÔNG copy vào repo)
# ├── tailwind.config.js      (port nội dung sang tailwind.config.ts; KHÔNG copy raw)
# ├── postcss.config.js       (đối chiếu, có thể copy nếu repo chưa đủ)
# ├── styles/tokens.css       (COPY → app/styles/tokens.css)
# ├── styles/components.css   (COPY → app/styles/components.css)
# ├── styles/index.css        (COPY → app/styles/index.css; chỉnh path import nếu cần)
# ├── login.html              (reference cho /auth/login)
# ├── callback.html           (reference cho /auth/callback)
# ├── new-project.html        (reference cho /)
# ├── dashboard.html          (reference cho /dashboard, derive cho __root + projects/{index,starred})
# ├── project-detail.html     (reference cho /projects/$id)
# └── settings.html           (reference cho /settings, derive cho /settings/profile)
```

**Structure Decision**: Single-repo web application giữ nguyên cấu trúc hiện hữu — feature này thuần frontend skinning, không tách module/package mới. Khu vực thay đổi tập trung `app/styles/`, `src/components/ui/`, `src/components/layout/`, `src/components/common/`, `src/components/home/HomePromptForm.tsx`, `src/routes/`, `tailwind.config.ts`. File outside scope (drizzle, server services, agents/codex runtime, db, security, ...) KHÔNG được touch.

## Phase Plan (4 PRs)

### PR0 — Constitution & supervisor scaffold (pre-flight, không tạo PR thực)

**Scope**: viết constitution feature, chuẩn bị invocation cho supervisor sub-agent. Không commit code thay đổi runtime.

**Deliverables**:
- `specs/029-builder-ui-lumen-port/constitution.md` chứa: 4 PR scope, invariants, source paths, file cấm động cho mỗi PR, shadcn-only primitive rule, supervisor verdict format (APPROVE / REJECT-with-violations / ESCALATE).
- Supervisor agent prompt template (có thể nằm trong constitution.md hoặc file riêng) định nghĩa: input (diff + constitution + build/dev output), output (verdict block + violations list), threshold escalate (REJECT cùng issue 2 lần liên tiếp).

**Success**: constitution.md tồn tại; user đọc xác nhận đủ chi tiết để supervisor làm việc; executor đọc nắm được scope từng PR.

### PR1 — Tokens & Tailwind config replacement

**Scope (touch only)**: `app/styles/{tokens.css,components.css,index.css}` (NEW), `app/styles/globals.css` (DELETE), `tailwind.config.ts` (REPLACE), `postcss.config.cjs` (CHECK), entry app file để import `app/styles/index.css` thay vì `app/styles/globals.css` (vd `src/router.tsx` hoặc `app.tsx` hoặc tsr root — confirm location khi execute).

**Cấm động**: `src/components/**`, `src/routes/**`, `src/server/**`, `src/features/**`, `src/agent/**`, `src/db/**`, `src/security/**`, mọi test, mọi config khác.

**Action sequence**:
1. Đọc `~/Library/.../d73d6816-.../styles/tokens.css` → write `app/styles/tokens.css` (1-1 nội dung).
2. Đọc `~/Library/.../d73d6816-.../styles/components.css` → write `app/styles/components.css`.
3. Đọc `~/Library/.../d73d6816-.../styles/index.css` → write `app/styles/index.css` (chỉnh import path tương đối nếu cần).
4. Đọc `~/Library/.../d73d6816-.../tailwind.config.js` → write `tailwind.config.ts` ở root: chuyển CommonJS module.exports → ESM/TS export default; giữ `content` glob của cloud-ai (`./app/**/*.{ts,tsx}` + `./src/**/*.{ts,tsx}`); copy `theme.extend` 1-1 (colors/fontFamily/fontSize/letterSpacing/spacing/maxWidth/borderRadius/borderWidth/boxShadow/transitionDuration/transitionTimingFunction/animation/keyframes); copy `plugins: []`.
5. Đối chiếu `postcss.config.cjs` cloud-ai với `postcss.config.js` open-design — cập nhật nếu thiếu autoprefixer hoặc tailwindcss plugin.
6. Tìm entry point app đang import `app/styles/globals.css` → đổi sang `app/styles/index.css`.
7. Xoá `app/styles/globals.css`.
8. `pnpm build` + `pnpm dev` để xác nhận không crash. Visual sẽ lệch (utility class cũ không generate màu) — chấp nhận.

**Supervisor verdict**:
- APPROVE if: build pass, dev start, đúng 4 file thay đổi (3 NEW + globals.css DELETE), tailwind.config.ts content khớp với open-design tailwind.config.js (ngoài content glob).
- REJECT if: touch ngoài scope; có file ngoài `app/styles/` + `tailwind.config.ts` + `postcss.config.cjs` + 1 entry import.

### PR2 — shadcn primitives + scaffold

**Scope (touch only)**:
- `src/components/ui/button.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/command.tsx` (refactor cva variants render class Lumen).
- Thêm primitives shadcn còn thiếu vào `src/components/ui/` nếu PR3 sẽ cần (tối thiểu hoá: chỉ thêm khi đã enumerate ở PR2 plan; tránh thêm dự phòng).
- `src/components/layout/AppSidebar.tsx`, `src/components/layout/WorkspaceShell.tsx`.
- `src/components/common/**` (mọi file).

**Cấm động**: `src/routes/**`, `src/components/home/**`, `src/components/auth/**`, `src/components/projects/**` (nếu có), mọi file PR1 đã sửa.

**Action sequence**:
1. Audit `src/components/ui/` enumerate primitive đã có. Đọc 6 HTML reference + components.css → list primitive sẽ cần (input, textarea ít nhất; có thể dropdown-menu, dialog, tooltip, tabs, separator, scroll-area tuỳ HTML).
2. Cho mỗi primitive còn thiếu: chạy `pnpm dlx shadcn@latest add <name>` (hoặc CLI tương đương) để generate file vào `src/components/ui/`. KHÔNG sửa import alias hoặc convention shadcn.
3. Refactor từng primitive trong `src/components/ui/`: cva variants render class Lumen (vd `.btn .btn-primary` cho button variant primary, `.input` cho input, `.card .card-hover` cho card surface). Public API (props variant/size/asChild) giữ tương thích shadcn.
4. Refactor `src/components/layout/AppSidebar.tsx`, `src/components/layout/WorkspaceShell.tsx`: dùng `.topbar`, `.topbar-link`, `.topbar-link-active`, `bg-paper`, `border-hairline`, `text-muted`/`text-ink`. Markup structure giữ.
5. Refactor file dưới `src/components/common/`: grep-replace utility cũ → mới.
6. `pnpm build` + `pnpm dev`. Tier 1 routes vẫn lệch ở section JSX cụ thể (sẽ fix PR3a) nhưng chrome đã đúng.

**Supervisor verdict**:
- APPROVE if: build pass, dev start, scope đúng (chỉ trong `src/components/{ui,layout,common}`), không touch routes/home/auth/projects components, primitive shadcn mới (nếu có) đặt đúng `src/components/ui/`, không có raw `<button>`/`<input>` mới được thêm trong file scope.
- REJECT if: scope creep, public API primitive bị đổi (vd `<Button variant="primary">` đổi sang `<Button kind="primary">`).

### PR3a — Tier 1 routes

**Scope (touch only)**:
- `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/dashboard/index.tsx`, `src/routes/projects/$projectId.tsx`.
- `src/components/home/HomePromptForm.tsx`.
- `src/components/auth/LoginModal.tsx` (chỉ xoá khi unreferenced sau khi index.tsx bỏ import; không refactor markup).
- Server function nhỏ liên quan post-login redirect (vd thay `to: "/"` thành `to: "/dashboard"` trong `auth.ts` callback) nếu cần.

**Cấm động**: tier 2 routes (`auth/{login,callback}`, `settings/*`, `projects/{index,starred}`, `user-guide.tsx`), `src/components/ui/**`, `src/components/layout/**`, `src/components/common/**`, file PR1 đã sửa, mọi file ngoài `src/routes/` + `src/components/home/HomePromptForm.tsx` + `src/components/auth/LoginModal.tsx`.

**Action sequence (walk-by-section, mixed mode)**:
1. **`__root.tsx`**: derive chrome từ `dashboard.html` `<header>` + `<nav>` block. Áp dụng `.topbar`, link active state, paper background.
2. **`/` (`routes/index.tsx`)**:
   - Đảo loader: `loader: async () => { const r = await getCurrentUser(); if (!r.user) throw redirect({ to: "/auth/login" }); return r; }`.
   - Bỏ `LoginModal` import, state `loginOpen` + setter, handler liên quan.
   - Component HomePage render hero: `<section class="hero"><div class="hero-inner">...</div></section>`. Markup theo `new-project.html`. Composer sử dụng `<HomePromptForm>` (sẽ refactor cùng PR).
3. **`/dashboard`**: 
   - Bỏ import + render `HomePromptForm` + state liên quan.
   - Layout list projects theo `dashboard.html`: card grid, `.eyebrow` cho section label, `.pill-soft` cho project meta, `.thumb-pattern`/`.dot-pattern` cho thumbnail (decision: copy 2 pattern này vào `components.css` repo, hoặc dùng inline style — chọn copy vào components.css nếu PR2 chưa thêm).
4. **`/projects/$id` (1467 dòng)** walk-by-section:
   - Chat composer block → `.composer .composer-row .composer-textarea`.
   - Plan/task step list → `.step .step-marker`, variant `.step-done/.step-running/.step-pending`.
   - Option card cho codex picks → `.option-card`, `.option-card-active`, `.option-check`.
   - Jump-to-latest pill → `.jump-latest`, toggle `.jump-latest-visible`.
   - Resizable split divider → `.split-divider`.
   - Sidebar/header trong route đó → `.topbar`, `bg-paper`, `border-hairline`.
   - Generic blocks → grep-replace tokens cũ → mới (`bg-canvas`→`bg-paper`, `text-body` 18px → `text-body` Lumen, `p-md`→`p-4`, `rounded-pill` cũ→`rounded-pill` Lumen).
   - JSX structure (div nesting, useState, useServerFn, useEffect, codex SDK calls) KHÔNG touch.
5. **`HomePromptForm.tsx`**: refactor markup outer → `<form class="composer">`, button submit → `<Button variant="primary">` (đã skin Lumen ở PR2). State + handler giữ.
6. **Post-login redirect**: kiểm tra server function callback / loader `/auth/callback.tsx` — nếu redirect mặc định đang là `/`, đổi sang `/dashboard`.
7. **LoginModal**: nếu sau khi index.tsx bỏ import, LoginModal không còn caller, xoá file. Nếu vẫn còn caller (vd composer button cho not-logged-in nào đó), giữ nguyên KHÔNG refactor.
8. `pnpm build` + `pnpm dev`. Eyeball check 4 surface tier 1 đối chiếu HTML.

**Supervisor verdict**:
- APPROVE if: build pass, dev start, contract test pass, không có file ngoài scope, không có raw `<button>`/`<input>` mới được thêm trong route code (tất cả phải qua `<Button>`/`<Input>`/...), `LoginModal` chỉ xoá nếu unreferenced.
- REJECT if: scope creep (vd touch settings.tsx); thay đổi codex SDK call / useEffect / state; thêm raw HTML primitive trong JSX route mới.

### PR3b — Tier 2 routes

**Scope (touch only)**: `src/routes/auth/login.tsx`, `src/routes/auth/callback.tsx`, `src/routes/settings/index.tsx`, `src/routes/settings/profile.tsx`, `src/routes/projects/index.tsx`, `src/routes/projects/starred.tsx`, `src/routes/user-guide.tsx`.

**Cấm động**: tier 1 routes (đã merge PR3a), `src/components/**`, `src/server/**`, mọi file PR1/PR2/PR3a đã sửa.

**Action sequence**:
1. `auth/login.tsx` ← markup từ `login.html` (form đặt giữa, paper bg, button primary). Logic OAuth/credential giữ.
2. `auth/callback.tsx` ← markup từ `callback.html` (loading state). Logic giữ.
3. `settings/index.tsx` ← markup từ `settings.html` (section group, divider, eyebrow). Logic giữ.
4. `settings/profile.tsx` ← derive từ `settings.html` chrome. Áp dụng cùng section style. Logic giữ.
5. `projects/index.tsx` + `projects/starred.tsx` ← derive từ `dashboard.html` chrome (topbar + project list grid). Logic giữ.
6. `user-guide.tsx` ← grep-replace token cũ → mới, không redesign markup.
7. `pnpm build` + `pnpm dev`. Eyeball check 7 surface.

**Supervisor verdict**:
- APPROVE if: build pass, dev start, contract test pass, không có raw primitive mới, không touch tier 1 / components.
- REJECT if: scope creep, raw primitive mới, sửa logic loader.

## Verification & Supervision

**Mode**: B (auto-merge với gates) + A+C supervisor (gate-guardian + spec-custodian) với hard-block + escalate.

**Per-PR loop**:
1. Executor commit theo scope khai báo trong constitution.
2. Supervisor sub-agent (Agent tool, subagent_type=general-purpose hoặc Explore) chạy:
   - Đọc `git show --stat HEAD` và `git show HEAD -- <touched files>`.
   - Đọc `specs/029-builder-ui-lumen-port/constitution.md` để biết scope của PR hiện tại.
   - Chạy `pnpm build` + `pnpm test` (contract tests).
   - Phát verdict block dưới định dạng: `VERDICT: APPROVE` hoặc `VERDICT: REJECT\nVIOLATIONS:\n- ...\n- ...`.
3. Nếu REJECT: executor đọc violations, fix, commit thêm; supervisor chạy lại.
4. Nếu cùng issue REJECT 2 lần liên tiếp: supervisor phát verdict `ESCALATE` kèm phân tích — dừng auto-loop, chờ user.
5. Nếu APPROVE: user mở `pnpm dev` URL eyeball confirm, sau đó mới sang PR tiếp.

**Visual verification**: dựa eyeball + 6 HTML reference (mở song song trong browser tab khác). Không setup screenshot diff tự động.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Conflict với Principle V (DESIGN.md) | Open-design ship design package dạng CSS/HTML, không phải DESIGN.md prose. Builder UI không phải storefront generated nên DESIGN.md hiện tại không cover. | Bịa DESIGN.md cho builder UI theo style storefront → vi phạm "Không over-engineer" + duplicate truth với CSS/HTML đã có. Thay bằng đề xuất bump constitution lên 1.5.0 phân biệt scope. |
| Tách 4 PR tuần tự thay vì 1 PR | PR1 thay foundation, PR2 ảnh hưởng leverage (primitives), PR3 tốn diff lớn (file 1467 dòng). 1 PR sẽ ~25-30 file thay đổi gồm cả config + tokens + 1467-line component → impossible to review. | 1 PR mega: review nightmare, rollback toàn bộ nếu sai 1 chỗ. 2 PR: vẫn quá lớn vì PR2+PR3 gộp lại > 80% diff. 4 PR là điểm cân bằng giữa atomic và per-PR success criterion rõ. |
| Identity replacement không có theme switch | User chọn full replace ở grill (câu 3 option A). Cloud-ai pre-production, không có user thực tế. | Theme switch (B trong grill câu 3) → thêm complexity multi-tenant không có nhu cầu thực tế. |
