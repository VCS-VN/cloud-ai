# Design Port Constitution — Builder UI Lumen

**Feature**: 029-builder-ui-lumen-port
**Status**: RETIRED 2026-06-09 (after PR3c sweep merge — see tasks.md Phase 4b for SC-009 enforcement override).
**Authority**: This document is the binding scope contract that the supervisor sub-agent enforces. Violations result in REJECT verdicts.

---

## 1. Source of truth

**Design source folder (read-only, ngoài repo)**:
```
~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/
```

**Files in source folder và vai trò**:
| File | Role |
|---|---|
| `tokens.json` | Token Studio Figma plugin artifact — KHÔNG copy vào repo, KHÔNG dùng làm runtime source |
| `tailwind.config.js` | Blueprint cho `tailwind.config.ts` — port nội dung, KHÔNG copy raw |
| `postcss.config.js` | Đối chiếu với `postcss.config.cjs` của repo — sync nếu thiếu |
| `styles/tokens.css` | COPY 1-1 → `app/styles/tokens.css` |
| `styles/components.css` | COPY 1-1 → `app/styles/components.css` |
| `styles/index.css` | COPY → `app/styles/index.css` (chỉnh import path tương đối nếu cần) |
| `login.html` | Reference visual cho `src/routes/auth/login.tsx` |
| `callback.html` | Reference visual cho `src/routes/auth/callback.tsx` |
| `new-project.html` | Reference visual cho `src/routes/index.tsx` (post-auth gated home) |
| `dashboard.html` | Reference visual cho `src/routes/dashboard/index.tsx`; derive cho `__root`, `projects/{index,starred}` |
| `project-detail.html` | Reference visual cho `src/routes/projects/$projectId.tsx` |
| `settings.html` | Reference visual cho `src/routes/settings/index.tsx`; derive cho `settings/profile.tsx` |

**Files committed vào repo**:
- `app/styles/tokens.css`
- `app/styles/components.css`
- `app/styles/index.css`
- `tailwind.config.ts` (port từ `.js`)
- (có thể) `postcss.config.cjs` (cập nhật)

**Files KHÔNG committed vào repo**: `tokens.json`, 6 HTML preview, `tailwind.config.js` raw.

---

## 2. Global invariants (áp dụng MỌI PR)

### INV-1 — Behavior preservation
KHÔNG thay đổi:
- Codex SDK calls, builder run logic, plan classifier, repair loop, cancel controller.
- Server functions (`src/server/functions/**`) trừ MỘT thay đổi nhỏ trong PR3a: post-login redirect mặc định từ `/` đổi sang `/dashboard`.
- Route loaders trừ TWO thay đổi trong PR3a: (a) `routes/index.tsx` đảo logic (gated post-auth), (b) `routes/dashboard/index.tsx` drop `HomePromptForm` import + state.
- React hooks: KHÔNG xoá `useEffect`, `useState`, `useServerFn`, custom hook (`useReveal`, ...). KHÔNG thay đổi dependency array.
- JSX structure: div nesting giữ nguyên trừ khi cần thêm wrapper Lumen (vd thêm `<section class="hero">` bao quanh content).

### INV-2 — Source of truth bound
Mọi color/typography/spacing/radius/shadow MUST đến từ `app/styles/tokens.css` (trực tiếp `--color-*`) hoặc `app/styles/components.css` (qua class component) hoặc `tailwind.config.ts` (utility class). KHÔNG hardcode hex literal trong TSX/CSS files khác.

### INV-3 — Forbidden code paths (CLAUDE.md)
KHÔNG thêm import vào `@/features/ai-agent/agent/`. KHÔNG recreate `@/server/services/message-service.ts`. KHÔNG tái lập route tree `/api/projects/$projectId/runs/`. Test contract `tests/contract/no-legacy-chat-path.contract.test.ts` MUST pass.

### INV-4 — shadcn-only primitives
Mọi UI primitive (button, input, textarea, label, dialog/modal, dropdown menu, popover, command palette, tooltip, toast, tabs, accordion, select, switch, checkbox, radio, slider, avatar, badge, separator, scroll area, ...) MUST đi qua `src/components/ui/*`.

**Concrete rules**:
- Feature/route code KHÔNG render raw `<button>`, `<input>`, `<textarea>`, `<select>`, `<dialog>`. Ngoại lệ: `<form>`, `<a>`, `<img>`, `<svg>`, `<div>`/`<span>` cho layout/wrapper, native HTML semantic tags (header/main/section/article/nav/footer).
- KHÔNG dựng modal/dropdown/popover/command từ `<div>` thô + state ad-hoc — phải dùng Radix-based wrapper từ `src/components/ui/`.
- Khi cần primitive chưa có trong `src/components/ui/`: tạo file mới qua `pnpm dlx shadcn@latest add <name>` HOẶC copy generated source theo convention shadcn (Radix + cva variants), đặt vào `src/components/ui/`. KHÔNG viết wrapper ad-hoc nằm ngoài `src/components/ui/`.
- Internal implementation của primitives ở `src/components/ui/*` MUST render class Lumen (`.btn`, `.btn-primary`, `.input`, `.card`, `.pill`, ...) qua cva variants. KHÔNG reference shadcn baseColor variables (`--background`, `--foreground`, `--primary`, `--accent`, `--muted`, `--destructive`, `--ring`, `--secondary`, `--popover`, `--card`).
- Public API của primitive (props `variant`, `size`, `asChild`, `disabled`, ...) MUST giữ tương thích shadcn convention.

### INV-5 — Token retirement
KHÔNG còn reference tới chuỗi sau trong `src/**` và `app/**` sau khi cả 4 PR merge: `--app-color-block`, `--app-hero-glow`, `--color-accent-magenta`, `figmaSans`, `figmaMono`, `bg-canvas`, `bg-lime`, `bg-lilac`, `bg-cream`, `bg-pink`, `bg-mint`, `bg-coral`, `bg-navy`, `bg-magenta`, `text-display-xl`, `text-display-lg`, `text-headline`, `text-subhead`, `text-link`, `text-button`, `p-md`, `p-lg`, `p-xl`, `space-section`, `shadow-editorial`, `shadow-panel`. (Một số có thể còn tồn tại sau PR1/PR2 nếu chưa scope vào — phải hết sau PR3b.)

### INV-6 — Build & runtime
`pnpm build` exit 0 sau mỗi PR. `pnpm dev` khởi động không crash sau mỗi PR.

### INV-7 — Surgical changes
Mỗi PR chỉ touch file thuộc danh sách scope ở section 3. KHÔNG refactor file ngoài scope dù thấy "có thể cải thiện".

---

## 3. Per-PR scope contract

### PR1 — Tokens & Tailwind config replacement

**Allowed touch**:
- `app/styles/tokens.css` (CREATE)
- `app/styles/components.css` (CREATE)
- `app/styles/index.css` (CREATE)
- `app/styles/globals.css` (DELETE)
- `tailwind.config.ts` (REPLACE)
- `postcss.config.cjs` (UPDATE nếu thiếu plugin)
- 1 entry file đang import `app/styles/globals.css` → đổi sang `app/styles/index.css` (dự kiến `src/router.tsx` hoặc `src/main.tsx` hoặc tsr root — confirm khi execute).

**Forbidden touch**:
- `src/components/**`
- `src/routes/**`
- `src/server/**`
- `src/features/**`
- `src/agent/**`
- `src/db/**`
- `src/security/**`
- `src/hooks/**`
- `src/lib/**`
- `src/shared/**`
- `src/types/**`
- `src/utils/**`
- `tests/**`
- Mọi file config khác (`drizzle.config.ts`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json`).

**Success criteria**:
- 4 file tạo/xoá đúng (3 CREATE + 1 DELETE).
- `tailwind.config.ts` có theme.extend chứa: colors (paper/chalk/surface/hairline/hairline-soft/ink/deep/muted/subtle + status nested object), fontFamily (sans/display/mono via var), fontSize (eyebrow/caption/ui-sm/body/body-lead/card-title/section-title/h1/h2/h3/display-compact/display), letterSpacing (display-tight/wide), spacing (topbar/prompt-max/container-max/control-sm/md/lg), maxWidth (prompt/container), borderRadius (input/button/card/modal/pill), borderWidth (hairline), boxShadow (card/card-hover/focus), transitionDuration (fast/base/slow), transitionTimingFunction (standard), animation (pulse-soft/spin-slow), keyframes (pulseSoft).
- `tailwind.config.ts` content glob giữ `./app/**/*.{ts,tsx}` + `./src/**/*.{ts,tsx}`.
- `pnpm build` pass + `pnpm dev` start.

**Supervisor REJECT triggers**:
- Touch file ngoài Allowed list.
- `tailwind.config.ts` thiếu token nhóm bất kỳ trong list trên.
- Hardcode hex literal (vd `#FDFAF6`) thay vì RGB triplet (`253 250 246`) trong tokens.css.
- Build/dev fail.

---

### PR2 — shadcn primitives + scaffold

**Allowed touch**:
- `src/components/ui/*` — refactor primitives đã có (`button.tsx`, `popover.tsx`, `command.tsx`) và CREATE primitives mới qua shadcn CLI nếu cần.
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/WorkspaceShell.tsx`
- (nếu có thêm file trong `src/components/layout/`, xác định scope khi audit)
- `src/components/common/**` — mọi file dưới folder này.

**Forbidden touch**:
- `src/components/home/**`
- `src/components/auth/**`
- `src/components/projects/**` (nếu folder có; chưa confirm — kiểm khi audit)
- `src/routes/**`
- `src/server/**`, `src/features/**`, `src/agent/**`, `src/db/**`, `src/security/**`, `src/hooks/**`, `src/lib/**`, `src/shared/**`, `src/types/**`, `src/utils/**`
- `app/styles/**` (PR1 đã xong)
- `tailwind.config.ts`, `postcss.config.cjs`
- `tests/**`
- Config root files.

**Success criteria**:
- Primitives `button.tsx`, `popover.tsx`, `command.tsx` refactored: cva variants render class Lumen, không còn reference shadcn baseColor variables.
- Public API primitives giữ nguyên (props `variant`, `size`, `asChild`, ...).
- Primitives mới (nếu add) đặt đúng `src/components/ui/`, generated theo convention shadcn, không có raw `<div>` thay cho Radix component.
- `AppSidebar.tsx`, `WorkspaceShell.tsx` dùng `.topbar`, `.topbar-link`, `.topbar-link-active`, `bg-paper`, `border-hairline`, `text-muted`/`text-ink`.
- `src/components/common/**` đã refactor token cũ → mới.
- `pnpm build` pass + `pnpm dev` start. Contract test pass.
- KHÔNG có raw `<button>`/`<input>`/`<textarea>`/`<select>`/`<dialog>` mới được thêm trong scope này.

**Supervisor REJECT triggers**:
- Touch ngoài Allowed.
- Primitive API public bị thay đổi (vd `<Button variant="primary">` đổi sang `<Button kind="primary">`).
- Còn reference `--background`, `--foreground`, `--primary`, `--accent`, `--muted`, `--destructive`, `--ring`, `--secondary`, `--popover`, `--card` trong primitives.
- Thêm raw HTML primitive mới trong scope.
- Build/dev/test fail.

---

### PR3a — Tier 1 routes

**Allowed touch**:
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/routes/dashboard/index.tsx`
- `src/routes/projects/$projectId.tsx`
- `src/components/home/HomePromptForm.tsx`
- `src/components/auth/LoginModal.tsx` (DELETE only nếu unreferenced sau khi `index.tsx` bỏ import; KHÔNG refactor markup).
- `src/server/functions/auth.ts` (CHỈ thay redirect target từ `/` sang `/dashboard` nếu có)
- `app/styles/components.css` (CHỈ thêm `.thumb-pattern`/`.dot-pattern` nếu PR3a quyết định promote 2 pattern này từ inline `<style>` của `dashboard.html` sang components.css repo — optional, ghi rõ nếu thực hiện).

**Forbidden touch**:
- Tier 2 routes: `src/routes/auth/login.tsx`, `src/routes/auth/callback.tsx`, `src/routes/settings/**`, `src/routes/projects/index.tsx`, `src/routes/projects/starred.tsx`, `src/routes/user-guide.tsx`.
- `src/components/ui/**` (PR2 đã xong)
- `src/components/layout/**` (PR2)
- `src/components/common/**` (PR2)
- `src/components/projects/**` (nếu có — chưa confirm)
- `src/server/**` ngoại trừ thay đổi nhỏ post-login redirect ở `auth.ts`.
- `src/features/**`, `src/agent/**`, `src/db/**`, `src/security/**`, `src/hooks/**`, `src/lib/**`, `src/shared/**`, `src/types/**`, `src/utils/**`
- `app/styles/{tokens.css,index.css}` (PR1 đã xong; components.css chỉ allowed để thêm 2 pattern thumbnail).
- `tailwind.config.ts`, `postcss.config.cjs`, config root.
- `tests/**`.

**Success criteria**:
- `__root.tsx` chrome (topbar/sidebar wrapper) match `dashboard.html`.
- `routes/index.tsx`:
  - Loader: logged-out → `redirect({ to: "/auth/login" })`; logged-in → render hero theo `new-project.html`.
  - KHÔNG còn import `LoginModal`, KHÔNG còn `loginOpen` state.
  - Hero render: `<section class="hero"><div class="hero-inner"><h1 class="hero-headline">...</h1><p class="hero-subtext">...</p><HomePromptForm /></div></section>` (markup reference theo `new-project.html`).
- `routes/dashboard/index.tsx`:
  - KHÔNG còn `HomePromptForm` import + state liên quan.
  - Layout list projects theo `dashboard.html`: card grid, eyebrow, pill-soft.
- `routes/projects/$projectId.tsx`:
  - Section đặc thù dùng class component Lumen (`.composer`, `.step*`, `.option-card*`, `.jump-latest*`, `.split-divider`).
  - Section generic grep-replace token cũ → mới.
  - JSX structure + hooks + codex SDK calls + state KHÔNG đổi.
- `HomePromptForm.tsx`: outer wrapper `.composer`, button submit dùng `<Button variant="primary">`.
- Post-login redirect mặc định = `/dashboard`.
- `pnpm build` pass + `pnpm dev` start. Contract test pass.

**Supervisor REJECT triggers**:
- Touch tier 2 routes hoặc components đã đóng băng từ PR2.
- Xoá `useEffect`, `useState`, `useServerFn`, custom hook, hoặc thay đổi dependency array.
- Thay đổi codex SDK call signature.
- Thêm raw `<button>`/`<input>`/`<textarea>`/`<select>`/`<dialog>` trong route code.
- `LoginModal` được refactor markup (chỉ allowed delete nếu unreferenced).
- `routes/index.tsx` vẫn còn `LoginModal` import.
- `routes/dashboard/index.tsx` vẫn còn `HomePromptForm`.
- Post-login redirect target vẫn là `/`.
- Build/dev/test fail.

---

### PR3b — Tier 2 routes

**Allowed touch**:
- `src/routes/auth/login.tsx`
- `src/routes/auth/callback.tsx`
- `src/routes/settings/index.tsx`
- `src/routes/settings/profile.tsx`
- `src/routes/projects/index.tsx`
- `src/routes/projects/starred.tsx`
- `src/routes/user-guide.tsx`

**Forbidden touch**:
- Tier 1 routes (PR3a đã xong).
- `src/components/**` toàn bộ (đã đóng băng từ PR2/PR3a).
- `src/server/**`, `src/features/**`, `src/agent/**`, `src/db/**`, `src/security/**`, `src/hooks/**`, `src/lib/**`, `src/shared/**`, `src/types/**`, `src/utils/**`
- `app/styles/**`, `tailwind.config.ts`, `postcss.config.cjs`, config root, `tests/**`.

**Success criteria**:
- Mỗi route refactor theo HTML reference tương ứng (hoặc derive cho route không có HTML).
- KHÔNG còn token cũ (`text-headline`, `text-subhead`, `text-display-xl`, `text-body` 18px, `bg-canvas`, `bg-lime/lilac/cream/pink/mint/coral/navy`, `bg-magenta`, `font-figmaSans`, `p-md/lg/xl`, `space-section`, `shadow-editorial`, `shadow-panel`) trong các file scope này.
- Logic loader / OAuth / credential validation giữ nguyên.
- KHÔNG có raw HTML primitive mới.
- `pnpm build` pass + `pnpm dev` start. Contract test pass.

**Supervisor REJECT triggers**:
- Touch ngoài Allowed list.
- Sửa logic loader / state / hook.
- Thêm raw HTML primitive.
- Còn token cũ trong file scope.
- Build/dev/test fail.

---

## 4. Supervisor sub-agent contract

**Invocation**: After mỗi commit của executor trong khuôn khổ feature 029.

**Inputs**:
1. `git show --stat HEAD` (file list).
2. `git show HEAD -- <touched files>` (diff).
3. Nội dung file `specs/029-builder-ui-lumen-port/constitution.md` (file này).
4. Output `pnpm build` (exit code + log nếu fail).
5. Output `pnpm test -- tests/contract/no-legacy-chat-path.contract.test.ts` (exit code).
6. PR identifier (PR1 / PR2 / PR3a / PR3b) — executor declare trong commit message dạng `[PR1] ...`.

**Tasks**:
1. Identify PR đang ở scope nào (đọc commit message hoặc human input).
2. Xác minh các file thay đổi nằm hoàn toàn trong Allowed touch list của PR đó. Bất kỳ file ngoài list → REJECT với violation `scope-creep: <file>`.
3. Xác minh không có file Forbidden touch list xuất hiện trong diff. Nếu có → REJECT với `forbidden: <file>`.
4. Xác minh INV-1 đến INV-7 (đặc biệt INV-4 shadcn-only, INV-5 token retirement, INV-2 source bound). Từng vi phạm là 1 violation.
5. Xác minh build + test pass. Fail → REJECT với `build-fail` hoặc `test-fail` kèm log snippet.
6. Phát verdict.

**Verdict format**:

```
VERDICT: APPROVE
PR: <PR1|PR2|PR3a|PR3b>
TOUCHED_FILES: <list>
NOTES: <optional>
```

hoặc

```
VERDICT: REJECT
PR: <PR1|PR2|PR3a|PR3b>
VIOLATIONS:
- <type>: <description>
- <type>: <description>
NEXT: executor fix các violation, commit thêm, supervisor chạy lại.
```

hoặc (sau REJECT lần thứ 2 cùng issue):

```
VERDICT: ESCALATE
PR: <PR1|PR2|PR3a|PR3b>
RECURRING_VIOLATIONS:
- <type>: <description> (lần 2)
ANALYSIS: <vì sao executor không tự fix được>
NEXT: chờ user quyết định.
```

**Loop control**:
- APPROVE → user mở `pnpm dev` URL eyeball, sau đó merge → sang PR tiếp.
- REJECT lần 1 → executor fix, commit thêm, supervisor chạy lại → APPROVE hoặc REJECT lần 2.
- REJECT lần 2 cùng issue → ESCALATE → user quyết.

---

## 5. Out of scope (KHÔNG làm trong feature này)

- Storefront generated UI (`templates/storefront/*/DESIGN.md`).
- Dark mode active (giữ comment reservation trong tokens.css).
- Multi-tenant theme switching.
- Visual regression test infrastructure (Playwright/Chromatic).
- Refactor structural `src/routes/projects/$projectId.tsx` thành sub-components.
- Bump constitution gốc (`.specify/memory/constitution.md`) lên 1.5.0 cho Principle V — ghi nhận TODO, làm trong PR riêng sau khi PR3b merge.
- Changes ngoài hai behavior change đã liệt kê (đảo loader `/`, drop `HomePromptForm` ở `/dashboard`, post-login redirect target).

---

## 6. Retirement

Constitution này được rút lui khỏi tình trạng ACTIVE sau khi:
1. PR3b merge vào `main`.
2. SC-001 → SC-009 trong `spec.md` đều pass.
3. User confirm visual final.

Sau đó file này giữ lại làm artifact lịch sử của feature, KHÔNG xoá.
