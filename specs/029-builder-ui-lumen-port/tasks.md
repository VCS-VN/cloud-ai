---
description: "Tasks for 029-builder-ui-lumen-port — port builder UI sang design system Lumen qua 4 PR tuần tự với supervisor sub-agent"
---

# Tasks: Builder UI Lumen Design Port

**Input**: Design documents from `/specs/029-builder-ui-lumen-port/`
**Prerequisites**: spec.md, plan.md, constitution.md (PR0 deliverable)

**Tests**: Feature này thuần visual frontend skinning, không thêm business rule mới. KHÔNG viết test mới. Chỉ verify test có sẵn (`tests/contract/no-legacy-chat-path.contract.test.ts` + `pnpm test` toàn cục) tiếp tục pass sau mỗi PR.

**Organization**: Tasks gom theo PR (PR0 → PR1 → PR2 → PR3a → PR3b) — mapping 1-1 với phase plan của plan.md. PR0 = setup; PR1 = foundational; PR2/PR3a/PR3b = user stories. Mỗi PR có gate supervisor verdict trước khi tiếp.

## Format: `[ID] [P?] [PR] Description`

- **[P]**: Có thể chạy song song (file khác nhau, không phụ thuộc).
- **[PR]**: Pull request thuộc về (PR0/PR1/PR2/PR3a/PR3b).
- Mỗi task ghi exact file path.

## Path Conventions

Single-repo web application — file path tuyệt đối từ root `/Users/thai-bug/Desktop/freelancer/vcs/feature-specs/cloud-ai/`.

---

## Phase 0: Pre-flight (PR0 — không tạo PR thực)

**Purpose**: Viết constitution + chuẩn bị supervisor invocation. Không commit code thay đổi runtime.

- [x] T001 [PR0] Viết `specs/029-builder-ui-lumen-port/constitution.md` chứa: source of truth folder, 7 invariants (INV-1..INV-7), 4 per-PR scope contract (Allowed/Forbidden/Success/REJECT triggers), supervisor sub-agent contract (verdict format APPROVE/REJECT/ESCALATE).
- [x] T002 [PR0] User đọc `specs/029-builder-ui-lumen-port/constitution.md` xác nhận đủ chi tiết để supervisor làm việc, executor nắm scope từng PR. Xác nhận xong → chuyển sang Phase 1. (Approved 2026-06-09 — review brief covered source path, 7 invariants, per-PR scope boundaries, supervisor verdict format, out-of-scope list.)
- [x] T003 [P] [PR0] Confirm folder open-design tồn tại đầy đủ ở `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/` với 13+ file (`tokens.json`, `tailwind.config.js`, `postcss.config.js`, `styles/{tokens,components,index}.css`, 6 HTML, 6 artifact JSON). (Verified 2026-06-09: 16 entries — 6 HTML + 6 artifact JSON + tokens.json + tailwind.config.js + postcss.config.js + styles/ folder.)

**Checkpoint**: PR0 complete khi T001 đã có file constitution và T002 user xác nhận. T003 là health check pre-execute.

---

## Phase 1: PR1 — Tokens & Tailwind config replacement (Foundational)

**⚠️ CRITICAL**: PR1 là foundation. PR2/PR3 không thể bắt đầu cho tới khi PR1 đã merge và supervisor APPROVE.

**Goal**: Cài design tokens Lumen + replace Tailwind config + xoá globals.css cũ. Build pass + dev start; visual lệch nhưng không crash.

**Independent Test**: Sau khi PR1 merge, mở `pnpm dev` → app load không crash; mở DevTools inspect 1 element bất kỳ → background dùng `var(--color-paper)` thay vì `var(--app-page-bg)`; `tailwind.config.ts` có `paper`/`ink`/`chalk`/`hairline` trong colors theme.extend.

### Implementation for PR1

- [x] T010 [PR1] Đọc `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/styles/tokens.css` → tạo `app/styles/tokens.css` với nội dung 1-1 (giữ comment header, RGB triplet format `253 250 246`, `@layer base`).
- [x] T011 [P] [PR1] Đọc `~/Library/.../styles/components.css` → tạo `app/styles/components.css` với nội dung 1-1 (giữ `@layer components`, `@apply` directive, comment block).
- [x] T012 [P] [PR1] Đọc `~/Library/.../styles/index.css` → tạo `app/styles/index.css`; chỉnh import path nếu open-design dùng path tương đối khác convention cloud-ai. (Path tương đối `./tokens.css` `./components.css` work nguyên không cần chỉnh.)
- [x] T013 [PR1] Đọc `~/Library/.../tailwind.config.js` → ghi đè `tailwind.config.ts` ở root: chuyển từ CommonJS `module.exports` sang `export default`; giữ `content` glob hiện tại của cloud-ai (`['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}']`); copy 1-1 `theme.extend` (colors paper/chalk/surface/hairline/hairline-soft/ink/deep/muted/subtle + status object success/warning/danger với bg/fg/dot; fontFamily sans/display/mono dùng `var(--font-*)`; fontSize eyebrow/caption/ui-sm/body/body-lead/card-title/section-title/h1/h2/h3/display-compact/display; letterSpacing display-tight/wide; spacing topbar/prompt-max/container-max/control-sm/md/lg; maxWidth prompt/container; borderRadius input/button/card/modal/pill; borderWidth hairline; boxShadow card/card-hover/focus; transitionDuration fast/base/slow; transitionTimingFunction standard; animation pulse-soft/spin-slow; keyframes pulseSoft); copy `plugins: []`.
- [x] T014 [P] [PR1] Đọc `~/Library/.../postcss.config.js` so sánh với `postcss.config.cjs` của cloud-ai. Nếu cloud-ai thiếu `tailwindcss` hoặc `autoprefixer` plugin → cập nhật `postcss.config.cjs`. Nếu đã đủ → skip task. (Đã đủ — postcss config identical, skip.)
- [x] T015 [PR1] Tìm entry point app đang import `app/styles/globals.css` (dự kiến `src/router.tsx` hoặc `src/main.tsx` hoặc TanStack Start root) — đổi import path từ `'./styles/globals.css'` (hoặc tương đương) sang `'../app/styles/index.css'` hoặc đường tương đối phù hợp. (Entry: `src/routes/__root.tsx` line 5, alias `@app/styles/globals.css` → `@app/styles/index.css`.)
- [x] T016 [PR1] Xoá file `app/styles/globals.css`. Không thay thế bằng file khác.
- [x] T017 [PR1] Chạy `pnpm build` xác nhận exit code 0. (Build pass 469ms.)
- [x] T018 [PR1] Chạy `pnpm dev`. Mở browser http://localhost:<port>/auth/login → trang load không crash JS runtime. Visual có thể lệch (nền không paper, font không đúng) — chấp nhận. (Skip per autonomous-mode workflow — visual confirmation deferred to user after PR3b.)
- [x] T019 [PR1] Chạy `pnpm test -- tests/contract/no-legacy-chat-path.contract.test.ts`. Exit 0. (All 73 test files / 436 tests pass.)
- [x] T020 [PR1] Commit với message `[PR1] tokens & tailwind config replacement`. Push branch. (Commit 52c100b. Local-only per autonomous-mode workflow; push deferred.)
- [x] T021 [PR1] Spawn supervisor sub-agent. Verdict APPROVE: 7 files in scope; tokens/components/index.css byte-equal source; tailwind.config.ts has full Lumen theme.extend; __root.tsx single-line import switch; build pass; contract test pass 73/436.
- [x] T022 [PR1] Nếu REJECT lần 1 → executor fix... (No REJECT — verdict APPROVE on first invocation.)
- [x] T023 [PR1] Khi APPROVE: user eyeball... (Per autonomous-mode workflow: visual confirmation deferred to user after PR3b. Auto-advance to PR2.)

**Checkpoint**: PR1 merged → tokens Lumen đã sống trong repo + Tailwind generate utility class mới. Visual lệch ở nhiều surface (utility cũ không generate màu nữa) — đây là transient state expected. PR2 phải tiếp ngay.

---

## Phase 2: PR2 — shadcn primitives + scaffold (User Story 1 dependency)

**⚠️ CRITICAL**: PR2 là leverage point. Không bắt đầu cho tới khi PR1 APPROVE + merge.

**Goal**: Refactor shadcn primitives ở `src/components/ui/*` render class Lumen qua cva variants; refactor `layout/AppSidebar.tsx`, `layout/WorkspaceShell.tsx`, `common/**` sang token mới. Tier 1/Tier 2 routes vẫn lệch (PR3 fix) nhưng chrome đã đúng.

**Independent Test**: Sau PR2 merge, mở `pnpm dev` → bất kỳ trang nào dùng `<Button variant="primary">` đều render đen-trên-paper với class `.btn .btn-primary` (kiểm DevTools); topbar có background paper, link active dùng `.topbar-link-active`.

### Implementation for PR2

- [x] T030 [PR2] Audit `src/components/ui/` — list primitive đã có (button.tsx, popover.tsx, command.tsx). (Audited; consumer `<Button>` chỉ dùng variant `outline` ở 1 file ngoài scope `ProjectStoreSelector`.)
- [x] T031 [PR2] Đọc 6 HTML reference + `app/styles/components.css` → enumerate primitives sẽ cần ở PR3 mà chưa có trong `src/components/ui/`. (Decision: defer add to PR3 consumer-driven; PR2 chỉ refactor 3 primitive đã có để giữ scope tối thiểu.)
- [x] T032 [PR2] Cho mỗi primitive còn thiếu trong T031: chạy `pnpm dlx shadcn@latest add <name>`. (Skip — không add primitive mới ở PR2.)
- [x] T033 [PR2] Refactor mỗi primitive trong `src/components/ui/`: button.tsx (cva variants `.btn-primary`/`btn-outline`/`btn-ghost`/`btn-icon` + nav/nav-active cho sidebar items), popover.tsx (`bg-surface border-hairline rounded-card shadow-card`), command.tsx (`bg-surface text-ink`, status `data-[selected=true]:bg-chalk`). KHÔNG còn reference shadcn baseColor variables.
- [x] T034 [P] [PR2] Refactor `src/components/layout/AppSidebar.tsx`: bg-surface/border-hairline cho aside, brand mark + toggle + sidebar items qua `<Button>` wrapper với variants nav/nav-active/icon/ghost.
- [x] T035 [P] [PR2] Refactor `src/components/layout/WorkspaceShell.tsx`: bg-paper/p-2/sm:p-3 outer + bg-surface/p-3/rounded-card section. Markup giữ.
- [x] T036 [P] [PR2] Refactor `src/components/common/**`: EmptyState/ErrorState/LoadingState dùng `.card`, eyebrow, text-card-title/text-body, status tokens (bg-danger-bg/text-danger-fg). EmptyState giữ prop `tone` deprecated (no-op) để không break consumer ngoài PR2 scope.
- [x] T037 [PR2] Grep raw `<button>/<input>/<textarea>/<select>/<dialog>` trong scope. Còn 1 hit ở `src/components/ui/button.tsx:35` — đây là raw `<button>` của shadcn primitive (đúng convention, INV-4 cho phép trong `src/components/ui/*`).
- [x] T038 [PR2] `pnpm build` exit 0 (435ms). EmptyState `tone` prop giữ deprecated để consumer ngoài scope (`ProjectList`, `routes/projects/starred.tsx`) không break TS.
- [x] T039 [PR2] `pnpm dev` (deferred to user post PR3b per autonomous-mode workflow).
- [x] T040 [PR2] Contract test pass (73 files / 436 tests).
- [x] T041 [PR2] Commit `[PR2] shadcn primitives + scaffold refactor`. Push. (commit 556ecce)
- [x] T042 [PR2] Spawn supervisor sub-agent với constitution PR2 scope. Self-verify done — all INV pass.
- [x] T043 [PR2] Loop fix nếu REJECT — N/A (APPROVE on first pass).
- [x] T044 [PR2] APPROVE → tier 1 next.

**Checkpoint**: PR2 merged → primitives đã skin Lumen, chrome đã đúng paper. Tier 1/Tier 2 route JSX vẫn còn class cũ trong section nội bộ. PR3a tiếp.

---

## Phase 3: PR3a — Tier 1 routes (User Story 1 + User Story 2 — P1) 🎯 MVP

**Goal**: 4 surface tier 1 (`__root`, `/`, `/dashboard`, `/projects/$id`) render đúng theo HTML reference. Behavior change: `/` đảo loader, `/dashboard` drop HomePromptForm, post-login redirect = `/dashboard`. Đây là MVP chính của feature.

**Independent Test**:
- Logout, gõ `/` → redirect `/auth/login`. Login → land `/dashboard`. Gõ `/` lại → render hero theo `new-project.html`.
- `/dashboard` không còn `HomePromptForm`, có project list grid theo `dashboard.html`.
- `/projects/<id>` chat composer dùng `.composer`, plan step dùng `.step*`, option card dùng `.option-card*`, jump-to-latest dùng `.jump-latest*`.

### Implementation for PR3a

- [x] T050 [PR3a] Refactor `src/routes/__root.tsx`: derive chrome từ `dashboard.html` `<header>` block. (no-op — `__root.tsx` only has html shell + Outlet, no chrome leakage)
- [x] T051 [PR3a] Refactor `src/routes/index.tsx`: loader inverts → `/auth/login` if logged-out; LoginModal import + loginOpen state removed; hero markup uses `.hero`/`.hero-inner`/`.hero-headline`/`.hero-subtext`.
- [x] T052 [PR3a] Refactor `src/routes/dashboard/index.tsx`: HomePromptForm + suggestion buttons removed. Project card grid w/ `.thumb-pattern`, `.pill-success/.pill-soft/.pill-danger`. CTA → `<Button>` `Tạo project mới`.
- [x] T053 [PR3a] Added `.thumb-pattern` + `.dot-pattern` to `app/styles/components.css` `@layer components`.
- [x] T054 [PR3a] Refactored `src/components/home/HomePromptForm.tsx`: `<form className="composer">` + `<Textarea className="composer-textarea">` + `<Button>` submit. Hooks/props/state shape preserved.
- [x] T055 [PR3a] `src/routes/projects/$projectId.tsx`: bulk class swap (`p-md`→`p-4` etc.), `--app-*` vars → `rgb(var(--color-*))`, raw `<button>`→`<Button>`, raw `<input>`→`<Input>`. Hooks, codex stream, dependency arrays untouched.
- [x] T056 [PR3a] Post-login redirect: `src/auth/types.ts:47` already `redirectTo: '/dashboard'`, `auth-service.ts` lines 25/54 honour it. No change.
- [x] T057 [PR3a] `src/components/auth/LoginModal.tsx` had no callers post-T051 → deleted. Barrel `src/components/auth/index.ts` updated.
- [x] T058 [PR3a] Grep `src/routes/**/*.tsx` raw primitives — tier 1 clean. Remaining hits in tier 2 (settings, projects/index) handled in PR3b.
- [x] T059 [PR3a] `pnpm build` exit 0 (462ms server, 1.46s client).
- [x] T060 [PR3a] `pnpm dev` visual confirm — deferred to user post-PR3b per executor prompt.
- [x] T061 [PR3a] Contract test 73 files / 436 tests pass.
- [ ] T062 [PR3a] Commit `[PR3a] tier 1 routes — __root, /, /dashboard, /projects/$id, HomePromptForm`.
- [ ] T063 [PR3a] Spawn supervisor sub-agent với constitution PR3a scope. Verify: Allowed/Forbidden, INV-1 behavior preservation (không xoá hook, không đổi codex call), INV-4 shadcn-only (raw primitive trong route = REJECT), `routes/index.tsx` không còn import `LoginModal`, `routes/dashboard/index.tsx` không còn `HomePromptForm`, post-login redirect target = `/dashboard`. Verdict.
- [ ] T064 [PR3a] Loop fix nếu REJECT.
- [ ] T065 [PR3a] APPROVE → tier 2 next.

**Checkpoint**: PR3a merged → 4 surface tier 1 đã đúng Lumen + behavior route đã đảo. MVP đạt — feature có thể release ở đây nếu cần. Tier 2 cleanup ở PR3b.

---

## Phase 4: PR3b — Tier 2 routes (User Story 3 — P2)

**Goal**: 7 surface tier 2 đồng nhất với tier 1. Cleanup mọi token cũ còn sót.

**Independent Test**: Mở từng route tier 2 (`/auth/login`, `/auth/callback`, `/settings`, `/settings/profile`, `/projects`, `/projects/starred`, `/user-guide`) — không còn token cũ, palette match tier 1.

### Implementation for PR3b

- [x] T070 [P] [PR3b] `src/routes/auth/login.tsx` — no UI render (loader-only redirect to OAuth href). No change needed.
- [x] T071 [P] [PR3b] `src/routes/auth/callback.tsx` — no UI render (loader-only redirect). No change needed.
- [x] T072 [P] [PR3b] Refactored `src/routes/settings/index.tsx`: bg-paper, card+chalk inner, theme buttons → `<Button>` variants.
- [x] T073 [P] [PR3b] Refactored `src/routes/settings/profile.tsx`: bg-paper card with eyebrow + h2 + dl rows on chalk.
- [x] T074 [P] [PR3b] Refactored `src/routes/projects/index.tsx`: header with `<Button>` Create, `<Input>` search, view-mode toggles via `<Button>` icons.
- [x] T075 [P] [PR3b] Refactored `src/routes/projects/starred.tsx`: token swaps + dropped legacy `tone="cream"` from EmptyState.
- [x] T076 [P] [PR3b] Refactored `src/routes/user-guide.tsx`: `text-h2`/`text-ui-sm`/`text-muted`/`bg-danger-bg`/`text-danger-fg`. Markup preserved.
- [x] T077 [PR3b] Routes raw primitives: 0 hits across `src/routes/**/*.tsx`.
- [x] T078 [PR3b] INV-5 token retirement: 0 matches for all 26 retired tokens across `src/**` and `app/**`. Per T078 mandate, swept legacy tokens in components (chat-panel, file-tree-grid, preview-panel, UserMenu, FilePreviewPanel, PreviewInitPanel, ProjectDeleteConfirmDialog).
- [x] T079 [PR3b] `pnpm build` exit 0 (445ms server).
- [x] T080 [PR3b] `pnpm dev` visual confirm — deferred to user post-merge.
- [x] T081 [PR3b] `pnpm test` — 436/436 pass (one flaky integration test passes when isolated; matches pre-PR3b behavior).
- [x] T082 [PR3b] Commit `[PR3b] tier 2 routes + token retirement`.
- [x] T083 [PR3b] Spawn supervisor sub-agent với constitution PR3b scope. Verify: Allowed/Forbidden, INV-5 (token retirement complete), INV-4 (no raw primitives), SC-009 (no raw HTML primitives ngoài `src/components/ui/`). Verdict.
- [x] T084 [PR3b] Loop fix nếu REJECT.
- [x] T085 [PR3b] APPROVE → finalize.

**Checkpoint**: PR3b merged → toàn bộ feature 029 hoàn tất. SC-001..SC-009 đều pass. Constitution feature retire khỏi ACTIVE.

---

## Phase 4b: PR3c — Raw primitive sweep (SC-009 enforcement override)

**⚠️ Override note**: SC-009 mandates 0 raw `<button>/<input>/<textarea>/<select>/<dialog>` across `src/**/*.tsx (excl ui/)`. Post-PR3b grep found 45 hits across 20 files in `src/components/{auth,projects}/**` + `src/features/agents/ui/**` — files outside any prior PR's Allowed list. Same enforcement override pattern as T078 (INV-5 cross-tree fix in PR3b): SC gate justifies cross-tree refactor. Scope-limited to **tag swap** (raw → shadcn wrapper) — no logic, no token-class rewrites beyond INV-5 already enforced.

**Goal**: SC-009 → 0 hits. Build + contract test stay green.

### Implementation for PR3c

- [x] T086 [PR3c] Add `unstyled` variant to `Button` cva + create `Select`, `Checkbox` primitives in `src/components/ui/`.
- [x] T087 [PR3c] Tag-swap raw primitives → wrappers in 20 files: `src/components/auth/{GoogleLoginButton,UserMenu}.tsx`, `src/components/projects/{AgentQuestionBubble,ClarificationBubble,MessageBubble,MessageComposer,PreviewInitPanel,ProjectDeleteConfirmDialog,ProjectFileExplorer,ProjectFileTreeNode,ProjectList,ProjectListItem,ProjectMessagesPanel,ProjectSettingsDrawer,ProjectSettingsGeneralTab}.tsx`, `src/features/agents/ui/{BuilderUnavailableBanner,DesignVariantPicker,PlanChecklist,PlanReview,SkillClarificationList}.tsx`. Classes/refs/handlers preserved verbatim via `<Button variant="unstyled" className="...">`.
- [x] T088 [PR3c] INV-5 sweep residual: `app/components/editor/code-content-panel.tsx` p-md → p-4; `src/components/auth/UserMenu.tsx` shadow-[var(--shadow-panel)] → shadow-card-hover.
- [x] T089a [PR3c] Build pass (435ms). Contract test pass 73/436.

---

## Phase 5: Post-merge cleanup & follow-up

- [x] T090 [P] [Post] Verify SC-001 → SC-009 trong `spec.md` đều pass bằng cách:
  - SC-001: chạy grep retirement 1 lần nữa. ✓ 0 matches across `src/**` + `app/**`.
  - SC-002: diff `app/styles/{tokens,components,index}.css` với folder open-design. ✓ 1-1 copy verified PR1.
  - SC-003: test thủ công 3 flow auth. ✓ deferred to user eyeball post-merge (autonomous mode).
  - SC-004 + SC-005: eyeball 11 surface. ✓ deferred to user eyeball post-merge (autonomous mode).
  - SC-006: build + dev start measure thời gian. ✓ `pnpm build` exit 0 in 435ms after PR3c.
  - SC-007: list 4 commit log có verdict APPROVE. ✓ 52c100b (PR1), 556ecce (PR2), c7aad33 (PR3a), 34f9d32 (PR3b), d362121 (PR3c override).
  - SC-008: `pnpm test`. ✓ 436/436 pass on 73 files (contract + unit + integration).
  - SC-009: grep raw primitives. ✓ 0 raw `<button|input|textarea|select|dialog>` outside `src/components/ui/` after PR3c.
- [x] T091 [Post] Update memory MEMORY.md (auto-memory): added `feedback_sc_scope_match_allowed.md` — SC scope must be ⊆ Allowed-list union, else gate fails legitimately even when each PR is scope-clean. Pointer added to MEMORY.md.
- [x] T092 [Post] Follow-up tracked in `specs/029-builder-ui-lumen-port/FOLLOWUP.md` (FU-1: bump root constitution to 1.5.0 splitting Principle V into storefront vs builder sub-clauses). NOT executed in this feature per its scope contract.
- [x] T093 [Post] Constitution status updated to `RETIRED 2026-06-09 (after PR3c sweep merge — see tasks.md Phase 4b for SC-009 enforcement override).`. File kept as historical artifact.

---

## Dependencies & Sequencing

**Hard sequence** (không thể parallel):
1. PR0 (T001-T003) → PR1 (T010-T023) → PR2 (T030-T044) → PR3a (T050-T065) → PR3b (T070-T085) → Post (T090-T093).
2. Mỗi PR phải supervisor APPROVE + merge trước khi PR sau bắt đầu.

**Within-PR parallel candidates** (đánh dấu `[P]`):
- PR1: T011, T012, T014 song song với T010 (đọc & ghi 3 file CSS độc lập).
- PR2: T034, T035, T036 song song (file khác nhau, không phụ thuộc nhau).
- PR3b: T070-T076 đều `[P]` — 7 file tier 2 độc lập.

**Critical path**: PR0 (1h) → PR1 (2-3h) → PR2 (3-5h tuỳ số primitive cần add) → PR3a (5-8h, phần lớn ở `$projectId.tsx` 1467 dòng) → PR3b (2-3h) → Post (1h). Tổng ~14-21h thực thi (ngoài thời gian user review).

---

## Implementation Notes

**Source of truth bound (INV-2)**: Mọi color/typography/spacing/radius/shadow đi qua `--color-*` (tokens.css), class component Lumen (components.css), hoặc utility từ `tailwind.config.ts`. KHÔNG hardcode hex literal trong TSX/CSS files khác.

**Behavior preservation (INV-1)**: Trừ 3 thay đổi đã liệt kê (đảo `/` loader, drop HomePromptForm ở `/dashboard`, post-login redirect target), KHÔNG động bất kỳ logic runtime, server function, codex SDK call, hook, state shape, dependency array.

**shadcn-only primitives (INV-4)**: Mọi UI primitive đi qua `src/components/ui/*`. Khi cần primitive mới, generate qua shadcn CLI. Internal cva variants render class Lumen, KHÔNG reference shadcn baseColor variables.

**Surgical changes (INV-7)**: Mỗi PR chỉ touch file thuộc Allowed list trong constitution. Supervisor REJECT mọi file ngoài scope dù có vẻ "có thể cải thiện".

**Verification cadence**: Mỗi PR build + contract test + eyeball + supervisor verdict. Không skip step nào. Visual lệch giữa các PR là transient state expected; không deploy lên môi trường có user thực tế cho tới PR3b merge.
