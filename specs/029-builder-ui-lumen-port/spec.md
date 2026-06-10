# Feature Specification: Builder UI Lumen Design Port

**Feature Branch**: `029-builder-ui-lumen-port`
**Created**: 2026-06-09
**Status**: Draft
**Input**: User description: Port toàn bộ builder UI cloud-ai sang design system Lumen do open-design.ai sinh ra cho client; thay thế identity playful (color blocks + magenta + hero glow + figmaSans) bằng identity editorial-quiet (paper/ink/chalk + status pastels + system font stack); chia thành 4 PR tuần tự (tokens → primitives → tier 1 routes → tier 2 routes); mỗi PR được một supervisor sub-agent giám sát theo mode gate-guardian + spec-custodian.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Builder UI render theo design Lumen trên các surface chính (Priority: P1)

Khi tôi đăng nhập vào builder UI và đi qua các surface chính (home `/`, danh sách projects `/dashboard`, chat với codex `/projects/$id`), toàn bộ chrome, typography, button, card, composer, plan/task panel phải render theo design Lumen: nền paper warm off-white, text ink gần đen, border hairline beige, button đen-đặc bo nhẹ, không còn block colors lime/lilac/coral, không còn hero glow radial gradient, không còn magenta accent.

**Why this priority**: Đây là yêu cầu chính của client. 90% thời gian sử dụng builder UI nằm ở 3 surface tier 1 này. Nếu chỉ 3 surface này theo Lumen thì đã đạt MVP visual của bản port; tier 2 (auth, settings, project list secondary, user-guide) có thể đến sau mà không chặn release.

**Independent Test**: Chạy `pnpm dev`, mở `/`, `/dashboard`, `/projects/<id>` của một project bất kỳ. Đối chiếu mắt với 3 file HTML reference (`new-project.html`, `dashboard.html`, `project-detail.html`) trong folder open-design. MVP đạt khi cả 3 surface không còn dấu vết identity cũ và đúng tinh thần editorial của Lumen.

**Acceptance Scenarios**:

1. **Given** một user đã login và đang ở `/`, **When** trang render xong, **Then** thấy hero center-aligned trên nền paper, headline editorial dùng font display, prompt input dạng composer card, không có block color trang trí và không có radial glow phía sau headline.
2. **Given** một user ở `/dashboard`, **When** trang load xong project list, **Then** thấy grid card với border hairline + shadow card mềm, eyebrow/section label dạng mono uppercase, không còn `HomePromptForm` ở dashboard.
3. **Given** một user ở `/projects/<id>` đang chat với codex, **When** mở composer, plan panel, jump-to-latest, option card cho codex picks, **Then** mỗi pattern render theo class component của Lumen (composer card phẳng, step marker tròn nhỏ, option card có check tick, jump-latest pill nổi đáy thread).
4. **Given** PR1 đã merge nhưng PR2/PR3 chưa, **When** user vào surface bất kỳ, **Then** app không crash; visual có thể lệch (class cũ không generate màu) nhưng route vẫn render và behavior không đổi.

---

### User Story 2 — Đảo logic route home `/` thành gated post-auth (Priority: P1)

Khi tôi gõ `/` mà chưa đăng nhập, app redirect sang `/auth/login`. Khi tôi đã đăng nhập, `/` render trang "new project" (theo `new-project.html`) — khác với `/dashboard` (theo `dashboard.html`). Sau khi login thành công, app đưa tôi tới `/dashboard` mặc định, không phải `/`.

**Why this priority**: Đây là behavior change duy nhất ngoài visual port, đi kèm User Story 1 và phải landed cùng PR3a. Nếu thiếu, `/` sẽ không match `new-project.html` và `/dashboard` sẽ vẫn còn `HomePromptForm` trùng vai trò.

**Independent Test**: Logout, gõ `/` → phải bị đẩy sang `/auth/login`. Login → phải landing tại `/dashboard`. Từ `/dashboard` gõ `/` trên URL bar → render trang home "new project" với prompt-centric hero.

**Acceptance Scenarios**:

1. **Given** user chưa login, **When** truy cập `/`, **Then** trình duyệt redirect tới `/auth/login`, không còn thấy `LoginModal` trên trang `/`.
2. **Given** user vừa login xong qua `/auth/callback`, **When** flow login hoàn tất, **Then** app đưa user tới `/dashboard` mặc định (không phải `/`).
3. **Given** user đã login, **When** gõ `/` trực tiếp trên URL, **Then** render trang home "new project" với hero + prompt input giống `new-project.html`, khác trang `/dashboard`.
4. **Given** user đã login đang ở `/dashboard`, **When** quan sát layout, **Then** không còn `HomePromptForm` ở dashboard (đã chuyển sang `/`); dashboard chỉ có project list + chrome.

---

### User Story 3 — Tier 2 surface theo Lumen (Priority: P2)

Khi tôi mở các surface phụ (`/auth/login`, `/auth/callback`, `/settings`, `/settings/profile`, `/projects` index/starred, `/user-guide`), chúng render theo Lumen tương ứng: login/callback theo `login.html`/`callback.html`, settings theo `settings.html`, projects index/starred derive từ `dashboard.html` chrome, user-guide chỉ swap token.

**Why this priority**: User vào ít hơn nhiều so với tier 1, nhưng visual lệch giữa tier 1 và tier 2 là inconsistency dễ thấy ngay khi user click qua. Phải dọn để hoàn thiện full replace.

**Independent Test**: Sau khi tier 1 đã merge, mở từng route tier 2, kiểm tra không còn class cũ render (không còn `bg-lime`, `text-headline` 26px, `font-figmaSans`...), và nhìn tổng thể đồng nhất với tier 1.

**Acceptance Scenarios**:

1. **Given** user mở `/auth/login`, **When** trang render, **Then** layout giống `login.html`: form đặt giữa, paper background, button primary đen.
2. **Given** user vào `/settings`, **When** trang load, **Then** layout match `settings.html` với section divider, eyebrow label, card group phẳng.
3. **Given** user vào `/projects` (index hoặc starred), **When** xem chrome, **Then** topbar + sidebar đồng nhất với `/dashboard`.
4. **Given** user vào `/user-guide`, **When** quan sát text, **Then** typography theo Lumen (text-body 14px, h-* tokens mới), không còn `text-body` 18px hoặc `text-headline` 26px cũ.

---

### User Story 4 — Mỗi PR được supervisor giám sát (Priority: P2)

Khi executor agent commit xong một PR (PR1, PR2, PR3a, PR3b), một supervisor sub-agent đọc diff, đối chiếu với constitution scope, chạy build, và ra verdict APPROVE / REJECT-with-violations. Nếu REJECT cùng issue 2 lần liên tiếp thì escalate cho người dùng quyết.

**Why this priority**: Đây là cơ chế chất lượng mà user yêu cầu rõ trong grill (mode B + supervisor A+C). Không thiết yếu cho visual outcome nhưng thiết yếu cho việc giữ scope từng PR khỏi lan ra.

**Independent Test**: Sau mỗi PR commit, kiểm tra có log/output từ supervisor: liệt kê file thay đổi, kiểm tra có file nằm ngoài scope không, kết quả build, verdict cuối cùng. Test bằng cách cố tình thêm 1 file ngoài scope vào commit thử — supervisor phải REJECT.

**Acceptance Scenarios**:

1. **Given** executor commit PR1 chỉ động `app/styles/*` + `tailwind.config.ts`, **When** supervisor chạy, **Then** verdict APPROVE.
2. **Given** executor commit PR1 nhưng đụng `src/components/home/HomePromptForm.tsx`, **When** supervisor chạy, **Then** verdict REJECT với violation "scope creep: HomePromptForm thuộc PR3a".
3. **Given** executor REJECT 2 lần liên tiếp cùng violation, **When** lần thứ 3, **Then** supervisor escalate cho user, dừng không tự retry tiếp.
4. **Given** một PR pass build và scope đúng, **When** supervisor APPROVE, **Then** user vào check `pnpm dev` URL bằng tay, xác nhận visual, mới sang PR tiếp theo.

---

### Edge Cases

- Nếu PR1 đã merge mà PR2 chậm: builder UI rơi vào trạng thái "broken half-state" (utility class cũ không render màu nữa). Cần coi đây là trạng thái transient và đẩy nhanh PR2; không deploy PR1 standalone lên môi trường có user thực tế.
- Component có inline style với hex literal cũ (vd `style={{ background: '#dceeb1' }}` cho lime block): grep theo class utility sẽ miss. Phải bổ sung grep theo hex literal của 7 block colors + magenta + figmaSans.
- `routes/__root.tsx` có thể chứa global wrapper áp dụng cho mọi route: nếu wrapper chứa class cũ, cả tier 2 sẽ bị ảnh hưởng dù chưa refactor. Phải port `__root` ngay trong PR3a.
- Hero pattern `.thumb-pattern` / `.dot-pattern` chỉ có trong block `<style>` của `dashboard.html`, không nằm trong `components.css`. Cần quyết định ở thì PR3a: copy thêm vào `components.css` repo cloud-ai (bổ sung), hay inline trong `dashboard/index.tsx`.
- Routes không có HTML reference (`__root`, `settings/profile`, `projects/index`, `projects/starred`): derive từ chrome `dashboard.html`/`settings.html`. Có thể lệch design intent designer; cần ghi nhận để rerun grill nếu designer phản hồi.
- `tests/contract/no-legacy-chat-path.contract.test.ts` chặn import lại đường chat cũ. Refactor sai có thể tạo import mới vào `@/features/ai-agent/agent/` hoặc `@/server/services/message-service.ts` và làm test fail.
- Khi designer cập nhật design (tokens.css/components.css/HTML thay đổi): không có cơ chế tự sync. Phải rerun grill và spawn 1 PR follow-up nằm ngoài scope feature này.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST cài đặt design tokens Lumen (paper/ink/chalk/hairline/muted/subtle + status success/warning/danger với bg/fg/dot) làm CSS variables ở `app/styles/tokens.css` và đặt làm nguồn duy nhất cho mọi color/typography/spacing/radius/shadow của builder UI.
- **FR-002**: Hệ thống MUST cài đặt component classes Lumen (`.btn*`, `.input`, `.textarea`, `.card*`, `.pill*`, `.topbar*`, `.eyebrow`, `.kbd`, `.divider-h`, `.hero*`, `.composer*`, `.step*`, `.option-card*`, `.jump-latest*`, `.split-divider`, `.section-label`, `.section-divider`, `.code-inline`, `.focus-ring`) tại `app/styles/components.css` để dùng chung trong tất cả surface.
- **FR-003**: Hệ thống MUST thay thế cấu hình Tailwind cũ bằng cấu hình tương đương file `tailwind.config.js` của open-design (theme extend chỉ chứa các token Lumen: colors paper/chalk/surface/hairline/hairline-soft/ink/deep/muted/subtle + status object; fontSize eyebrow/caption/ui-sm/body/body-lead/card-title/section-title/h1/h2/h3/display-compact/display; spacing topbar/prompt-max/container-max/control-sm/md/lg; borderRadius input/button/card/modal/pill; boxShadow card/card-hover/focus; transitionDuration fast/base/slow), giữ `content` glob của repo cloud-ai (`./app/**/*.{ts,tsx}` + `./src/**/*.{ts,tsx}`).
- **FR-004**: Hệ thống MUST loại bỏ hoàn toàn `app/styles/globals.css` cũ và 63 token `--app-*`, cùng với các utility class cloud-ai cũ (`bg-canvas`, `bg-lime/lilac/cream/pink/mint/coral/navy`, `bg-magenta`, `text-display-xl/lg`, `text-headline`, `text-subhead`, `text-body` 18px, `text-link`, `text-button`, `font-figmaSans`, `p-md/lg/xl`, `space-section`, `shadow-editorial`, `shadow-panel`, `rounded-pill` value cũ).
- **FR-005**: Hệ thống MUST đảm bảo `app/styles/index.css` được nạp ở entry app sao cho `@layer base` của tokens và `@layer components` của components.css đều xuất hiện trong CSS bundle Tailwind generate ra.
- **FR-006**: Hệ thống MUST refactor `src/components/ui/button.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/command.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/WorkspaceShell.tsx`, và mọi file dưới `src/components/common/` để dùng class Lumen (`btn*`, `topbar*`, `bg-paper`, `border-hairline`, `bg-surface`, `rounded-card`, `shadow-card`...) thay shadcn variables (`--background`, `--foreground`, `--primary`...) và utility cloud-ai cũ.
- **FR-007**: API public của `<Button>` phải giữ nguyên (cùng prop `variant`, `size`, `asChild`...) sao cho mọi call site hiện hữu trong codebase không phải đổi; chỉ render output đổi sang class Lumen.
- **FR-008**: Hệ thống MUST refactor `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/dashboard/index.tsx`, `src/routes/projects/$projectId.tsx`, và `src/components/home/HomePromptForm.tsx` để render theo HTML reference tương ứng (`dashboard.html` chrome cho `__root`, `new-project.html` cho `/`, `dashboard.html` cho `/dashboard`, `project-detail.html` cho `/projects/$id`), giữ nguyên markup structure (div nesting), state hook, server function call, codex SDK call.
- **FR-009**: Hệ thống MUST đảo logic loader của `src/routes/index.tsx` sao cho user chưa login bị `redirect({ to: "/auth/login" })`, user đã login render component HomePage mới (theo `new-project.html`); xoá `LoginModal` import và state liên quan khỏi route này.
- **FR-010**: Hệ thống MUST loại bỏ `HomePromptForm` (và state/handler liên quan) khỏi `src/routes/dashboard/index.tsx`; thay vào layout list projects theo `dashboard.html`.
- **FR-011**: Hệ thống MUST cập nhật flow đăng nhập sao cho callback hoặc đích redirect mặc định sau khi login là `/dashboard` (không phải `/`).
- **FR-012**: Hệ thống MUST refactor `src/routes/projects/$projectId.tsx` theo chiến lược walk-by-section mixed mode: section đặc thù (composer, plan/task step, option card, jump-to-latest, resizable split) map sang class component dành riêng của Lumen; section generic (sidebar, header, plain text wrapper) grep-replace utility cũ → mới; markup gốc + JSX structure + hook giữ nguyên.
- **FR-013**: Hệ thống MUST refactor các route tier 2 (`src/routes/auth/login.tsx`, `src/routes/auth/callback.tsx`, `src/routes/settings/index.tsx`, `src/routes/settings/profile.tsx`, `src/routes/projects/index.tsx`, `src/routes/projects/starred.tsx`, `src/routes/user-guide.tsx`) theo HTML reference tương ứng hoặc derive từ chrome dashboard/settings cho route không có HTML.
- **FR-014**: Hệ thống MUST loại bỏ mọi reference tới identity-specific tokens `--app-color-block*`, `--app-on-color-block`, `--app-icon-on-color-block`, `--app-hero-glow`, magenta accent (`--color-accent-magenta`) tại lớp tokens, cấu hình Tailwind, lẫn call site component; thay block colors bằng `bg-chalk`/`bg-paper`/`bg-surface` tuỳ chỗ; xoá hoàn toàn hero glow.
- **FR-015**: Quá trình triển khai MUST chia làm bốn pull request tuần tự (PR1 tokens & config, PR2 primitives & scaffold, PR3a tier 1 routes, PR3b tier 2 routes); không gộp scope; mỗi PR có một success criterion riêng; user merge tuần tự sau khi xác nhận.
- **FR-016**: Hệ thống MUST có một "design port constitution" được viết trước khi PR1 bắt đầu, đặt tại folder spec của feature này (`specs/029-builder-ui-lumen-port/constitution.md` hoặc tương đương), liệt kê: scope từng PR, các invariants (KHÔNG động behavior, KHÔNG bịa token, KHÔNG refactor ngoài scope), source paths của design package, danh sách file cấm động ở mỗi PR.
- **FR-017**: Mỗi PR MUST được kiểm tra bởi một supervisor sub-agent đóng vai trò gate-guardian + spec-custodian: đọc diff so với constitution, chạy build, ra verdict APPROVE / REJECT-with-violations.
- **FR-018**: Hệ thống MUST hard-block executor không được sang PR tiếp theo khi supervisor REJECT, NHƯNG phải escalate cho user nếu cùng issue bị REJECT 2 lần liên tiếp; user là quyết định cuối khi escalate.
- **FR-019**: Build (`pnpm build`) MUST pass và dev server (`pnpm dev`) MUST khởi động không crash sau mỗi PR; visual có thể lệch nhưng app phải chạy.
- **FR-020**: Hệ thống MUST KHÔNG tạo path mới vào `@/features/ai-agent/agent/`, KHÔNG recreate `@/server/services/message-service.ts`, KHÔNG tái lập `/api/projects/$projectId/runs/` (theo CLAUDE.md). Test contract `tests/contract/no-legacy-chat-path.contract.test.ts` MUST tiếp tục pass.
- **FR-021**: Hệ thống MUST KHÔNG check vào repo các file `tokens.json`, 6 file HTML preview, hoặc `tailwind.config.js` raw của open-design; chỉ ba file CSS (`tokens.css`, `components.css`, `index.css`) và bản port `tailwind.config.ts` được commit.
- **FR-022**: Mọi UI primitive (button, input, textarea, label, dialog/modal, dropdown menu, popover, command palette, tooltip, toast, tabs, accordion, select, switch, checkbox, radio, slider, avatar, badge, separator, scroll area, ...) trong builder UI MUST đi qua shadcn component layer đặt tại `src/components/ui/*`. Code feature/route KHÔNG được tự render `<button>`, `<input>`, `<textarea>`, `<dialog>`, hoặc dựng modal/dropdown/popover/command từ `<div>` thô — phải import wrapper từ `src/components/ui/`.
- **FR-023**: Khi một primitive shadcn cần dùng nhưng chưa tồn tại trong `src/components/ui/`, executor MUST tạo file primitive mới theo convention shadcn (Radix-based, cva variants) trước khi consume; KHÔNG được viết wrapper ad-hoc nằm ngoài `src/components/ui/`.
- **FR-024**: Internal implementation của shadcn primitives ở `src/components/ui/*` MUST render class Lumen (`.btn`, `.btn-primary`, `.input`, `.card`, `.pill`, ...) qua cva variants, KHÔNG dùng shadcn baseColor variables (`--background`, `--foreground`, `--primary`, `--accent`, `--muted`, `--destructive`, `--ring`, ...). Public API của primitive (props `variant`, `size`, `asChild`...) MUST giữ tương thích với shadcn convention để các call site không phải đổi.

### Key Entities

- **Design Package (Lumen)**: tập artifact do open-design.ai sinh ra cho client, sống ngoài repo cloud-ai tại folder Application Support; bao gồm `tokens.json` (Token Studio), `tailwind.config.js`, `styles/tokens.css`, `styles/components.css`, `styles/index.css`, `postcss.config.js`, và 6 HTML preview render. Source of truth visual cho feature này.
- **Token Layer**: ba file CSS (`tokens.css`, `components.css`, `index.css`) đã được commit vào `app/styles/` của repo, cộng với `tailwind.config.ts` đã port. Đại diện cho lớp design system trong code.
- **Builder UI Surface**: tập 11 route + sidebar + topbar + composer + plan/task panel của builder UI cloud-ai. Phân làm tier 1 (4 surface ưu tiên) và tier 2 (7 surface phụ).
- **Constitution**: tài liệu sống ở spec folder, liệt kê scope/invariants/cấm-động cho từng PR. Là input cho supervisor agent.
- **Supervisor Agent**: sub-agent đóng vai trò gate-guardian + spec-custodian; đọc diff + build + constitution, ra verdict; có thể escalate.
- **Identity-specific Token (orphan)**: 5 token `--app-color-block*` + `--app-hero-glow` + magenta accent — không có equivalent trong Lumen, phải retire.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau khi cả 4 PR merge, không còn bất kỳ reference nào tới chuỗi `--app-color-block`, `--app-hero-glow`, `--color-accent-magenta`, `figmaSans`, `figmaMono`, `bg-canvas`, `bg-lime`, `bg-lilac`, `bg-cream`, `bg-pink`, `bg-mint`, `bg-coral`, `bg-navy`, `bg-magenta`, `text-display-xl`, `text-display-lg`, `text-headline`, `text-subhead`, `text-link`, `text-button`, `p-md`, `p-lg`, `p-xl`, `space-section`, `shadow-editorial`, `shadow-panel` trong `src/**` và `app/**`.
- **SC-002**: Sau PR1, repo cloud-ai có ba file `app/styles/{tokens.css,components.css,index.css}` với nội dung khớp với folder open-design (so sánh dòng-cho-dòng), và `tailwind.config.ts` có theme extend chứa đúng tập token Lumen liệt kê ở FR-003.
- **SC-003**: User chưa login truy cập `/` đều bị redirect tới `/auth/login` (kiểm tra bằng cách logout + truy cập trực tiếp). User đã login truy cập `/` thấy hero `new-project.html` (không phải dashboard list). User đã login đăng nhập từ `/auth/callback` được đưa thẳng tới `/dashboard`.
- **SC-004**: Trên 3 surface tier 1, đối chiếu mắt với HTML reference cho thấy chrome (topbar/sidebar), hero, composer, plan step, option card, jump-to-latest, card grid render đúng cấu trúc, đúng màu paper/ink/chalk, đúng typography editorial.
- **SC-005**: Trên 7 surface tier 2, không còn lệch palette so với tier 1 (cùng paper background, cùng border hairline, cùng button đen-đặc); login/callback/settings match HTML reference tương ứng.
- **SC-006**: `pnpm build` exit code 0 sau mỗi PR (PR1, PR2, PR3a, PR3b). `pnpm dev` khởi động trong dưới 30 giây và serve trang `/auth/login` không lỗi runtime sau mỗi PR.
- **SC-007**: Supervisor agent đã chạy và post log/output cho mỗi PR; constitution `specs/029-builder-ui-lumen-port/constitution.md` (hoặc tương đương) tồn tại trước khi PR1 bắt đầu commit. Mỗi PR có ít nhất một verdict APPROVE từ supervisor trước khi merge.
- **SC-008**: Test contract `tests/contract/no-legacy-chat-path.contract.test.ts` pass sau từng PR. Toàn bộ test suite hiện hữu (`pnpm test`) không có test mới fail do thay đổi của feature này.
- **SC-009**: Sau khi cả 4 PR merge, `grep` toàn bộ `src/**/*.tsx` (loại trừ `src/components/ui/`) trả về 0 match cho regex `<(button|input|textarea|select|dialog)\b` (raw HTML primitives) ngoài context tham chiếu thuần text/comment. Mọi modal/popover/dropdown/command surface đều đi qua import từ `@/components/ui/*`.

## Assumptions

- Folder design package open-design tồn tại đầy đủ tại path `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/d73d6816-bb7f-419e-b4ed-7a6557229369/` trên máy executor agent suốt thời gian thực thi feature.
- Designer không thay đổi nội dung folder open-design giữa các PR; bất kỳ thay đổi nào xảy ra giữa chừng được coi là out-of-scope và xử lý qua một feature follow-up.
- Cloud-ai chưa có dark mode active; phần placeholder dark theme trong tokens.css giữ ở dạng comment, không implement.
- Cloud-ai chưa có visual regression test infrastructure; verification visual dựa vào user eyeball trên `pnpm dev` URL, không setup Playwright/Chromatic trong scope này.
- Mỗi PR sẽ được merge tuần tự trong cùng một môi trường dev; không có chiến lược feature flag để bật/tắt design Lumen song song với identity cũ.
- Routes `__root`, `routes/projects/index.tsx`, `routes/projects/starred.tsx`, `routes/settings/profile.tsx` không có HTML preview riêng; design intent được derive từ chrome của `dashboard.html` (cho list project) và `settings.html` (cho profile), với rủi ro lệch nhỏ so với mong muốn designer — chấp nhận trong scope này.
- Component lớn `src/routes/projects/$projectId.tsx` (1467 dòng) KHÔNG được tách thành sub-component trong feature này; refactor structural đó được defer sang feature sau nếu cần.
- Storefront generated UI (templates/storefront/* DESIGN.md) hoàn toàn không thay đổi.
- Cloud-ai đang ở trạng thái pre-production: việc xoá globals.css và bridge tokens cũ không cần backward-compatible shim hay migration script.
- Pre-flight task đầu tiên là viết file constitution `specs/029-builder-ui-lumen-port/constitution.md` trước khi executor bắt đầu PR1.
