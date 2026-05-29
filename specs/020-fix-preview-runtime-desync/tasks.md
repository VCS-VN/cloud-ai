---
description: "Task list for fix preview runtime state desync"
---

# Tasks: Fix preview runtime state desync

**Input**: Design documents from `specs/020-fix-preview-runtime-desync/`
**Prerequisites**: plan.md, spec.md, quickstart.md
**Tests**: Spec yêu cầu unit test cho `mergeLiveStatus` (truth table) và `ensureRunning` (loopback) — bắt buộc.
**Organization**: Group theo user story (US1, US2, US3) như spec để mỗi story có thể demo độc lập.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (file khác nhau, không phụ thuộc task chưa xong).
- **[Story]**: US1 (start mới + thấy preview), US2 (auto-heal stuck), US3 (invariant nhất quán).
- Mọi task có file path tuyệt đối tương đối repo root.

## Path Conventions

Single TypeScript project (TanStack Start). Source ở `src/`, test colocated tại `src/**/__tests__/**/*.test.ts` theo `vitest.config.ts`. Không có `tests/` riêng cho domain runtime.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Không có infra mới. Phase này xác nhận môi trường test đang chạy được trước khi viết test mới.

- [X] T001 Verify vitest có thể chạy cho domain runtime: từ repo root chạy `pnpm vitest run src/features/ai-agent/runtime` và confirm có 0 file/0 test (vì `__tests__` rỗng) hoặc tất cả pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor `mergeLiveStatus` thành named function thuần để testable trước khi viết test/thay đổi logic. Đây là blocking cho cả US1, US2, US3 vì cả ba đều cần test logic mới.

**⚠️ CRITICAL**: Không user story work nào bắt đầu trước khi T002 xong. Sau T002, các story phase chạy song song được.

- [X] T002 Refactor `mergeLiveStatus` thành named exported pure function trong `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`: tạo `export function mergeLiveStatus(runtime: DevRuntime, pm2: PreviewPm2Process): DevRuntime` ngoài class, giữ nguyên signature/return type cũ; class method `private mergeLiveStatus` chuyển thành delegate `return mergeLiveStatus(runtime, pm2);`. Không thêm logic mới ở task này — chỉ extract.

**Checkpoint**: Function pure, named-exported, sẵn sàng nhận thay đổi và unit test trực tiếp.

---

## Phase 3: User Story 2 - Auto-heal stuck projects (Priority: P1) 🎯 MVP

**Goal**: Project đang stuck (`enabled:true`, `status:error|stopped|...`, có previewUrl + port, pm2 online) tự về `running` ngay khi UI poll, kèm xoá `lastError`/`lastErrorTier`.

**Why MVP**: User đang gặp lỗi này ngay bây giờ. Story này một mình deploy được cũng giải quyết complaint hiện tại — không cần chờ US1 (loopback) vì bug đã xảy ra ở các project có sẵn. US1 ngăn ngừa case mới, US2 fix case cũ.

**Independent Test**: Mock `projectStateStore` trả DB `status:"error", enabled:true, previewUrl:"https://...", port:12345, lastError:"..."`. Mock `pm2Driver.describe` trả `status:"online", pid:777`. Gọi `getRuntimeState(projectId)`. Kết quả: `status:"running", pid:777, lastError:null, lastErrorTier:null`.

### Tests for User Story 2 ⚠️

> Viết test trước, đảm bảo FAIL với codepath hiện tại (chưa có nhánh upgrade).

- [X] T003 [P] [US2] Tạo file `src/features/ai-agent/runtime/__tests__/runtime-orchestrator-merge-live-status.test.ts`. Import `mergeLiveStatus` từ `@/features/ai-agent/runtime/runtime-orchestrator.server`. Viết helper `buildRuntime(overrides: Partial<DevRuntime>): DevRuntime` (spread `EMPTY_DEV_RUNTIME` từ `@/features/ai-agent/project/project-state.schema`) và `buildPm2(overrides: Partial<PreviewPm2Process>): PreviewPm2Process`.
- [X] T004 [US2] Trong cùng file T003, thêm test "upgrade: error + pm2 online + previewUrl + port + enabled:true → running" — DB `{status:"error", enabled:true, previewUrl:"https://x", port:12345, lastError:"old", lastErrorTier:"system"}`, pm2 `{status:"online", pid:777}`. Kỳ vọng `{status:"running", pid:777, lastError:null, lastErrorTier:null}`. (Truth table case #4)
- [X] T005 [US2] Thêm test "upgrade: stopped + pm2 online + previewUrl + port + enabled:true → running". (Case #5)
- [X] T006 [US2] Thêm test "upgrade: starting + pm2 online + previewUrl + port + enabled:true → running". (Case #6)
- [X] T007 [US2] Thêm test "upgrade: installing + pm2 online + previewUrl + port + enabled:true → running". (Case #11)

### Implementation for User Story 2

- [X] T008 [US2] Trong `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`, thêm nhánh upgrade vào `mergeLiveStatus` đã extract ở T002. Đặt nhánh này SAU hai nhánh hiện có (downgrade running→stopped/error, confirm running→running). Logic chính xác:
  ```ts
  if (
    runtime.enabled &&
    pm2.status === "online" &&
    runtime.previewUrl &&
    runtime.port &&
    runtime.status !== "running"
  ) {
    return { ...runtime, status: "running", pid: pm2.pid, lastError: null, lastErrorTier: null };
  }
  ```
  Sau đó chạy lại các test T004-T007 — phải pass.

**Checkpoint**: User Story 2 hoàn thành. Auto-heal đã chạy ở mọi gọi `getRuntimeState`. Deploy độc lập task này được, project đang stuck heal trong < 3s poll cycle.

---

## Phase 4: User Story 3 - Invariant nhất quán (Priority: P2)

**Goal**: `mergeLiveStatus` không nâng cấp sai — không hồi sinh project `enabled:false`, không upgrade khi thiếu previewUrl/port, vẫn downgrade khi pm2 không online.

**Note dependency**: Phase này MỞ RỘNG truth table coverage của Phase 3. Có thể chạy SONG SONG với Phase 3 sau khi T002 xong (mỗi test độc lập), nhưng implementation T008 phải hoàn thành để các test "upgrade" pass.

**Independent Test**: Cùng file `runtime-orchestrator-merge-live-status.test.ts`, chạy `pnpm vitest run src/features/ai-agent/runtime/__tests__/runtime-orchestrator-merge-live-status.test.ts` — toàn bộ truth table 12 case pass.

### Tests for User Story 3 ⚠️

- [X] T009 [P] [US3] Thêm test "downgrade kept: running + pm2 missing → stopped, pid null, lastError 'not running'". (Case #2)
- [X] T010 [P] [US3] Thêm test "downgrade kept: running + pm2 errored → error, pid null, lastError 'not healthy'". (Case #3)
- [X] T011 [P] [US3] Thêm test "confirm kept: running + pm2 online + previewUrl + port → running, pid pm2". (Case #1)
- [X] T012 [P] [US3] Thêm test "no upgrade: error + pm2 online + previewUrl null + port có → giữ nguyên runtime input". (Case #7)
- [X] T013 [P] [US3] Thêm test "no upgrade: error + pm2 online + previewUrl có + port null → giữ nguyên". (Case #8)
- [X] T014 [P] [US3] Thêm test "no upgrade: error + pm2 online + previewUrl/port + enabled:false → giữ nguyên (Q8 invariant)". (Case #9)
- [X] T015 [P] [US3] Thêm test "no upgrade: stopped + pm2 missing/stopped → giữ nguyên". (Case #10)
- [X] T016 [P] [US3] Thêm test "no upgrade: running + pm2 online + previewUrl null → giữ nguyên (confirm path không match nhưng cũng không upgrade vì status đã = running)". (Case #12)

### Implementation for User Story 3

Không có code mới — invariant được đảm bảo bởi cấu trúc 3 nhánh đã viết ở T008. Phase này thuần test coverage.

**Checkpoint**: 12 case truth table pass. Đảm bảo không regression theo cả 4 chiều của bảng trạng thái.

---

## Phase 5: User Story 1 - Start preview với loopback health (Priority: P1)

**Goal**: Khi user click Start preview, hệ thống probe Vite ở `http://127.0.0.1:${port}/` thay vì URL Cloudflare công khai. Tránh false-error do tunnel/DNS chưa propagate.

**Independent Test**: Mock `pm2Driver.start` trả `{pid: 999}`, mock `pm2Driver.describe` trả `online`, mock `healthCheck` (truyền vào constructor `RuntimeOrchestrator`) — assert URL nhận được khớp `^http://127\.0\.0\.1:\d+/$`. Sau khi orchestrator hoàn tất, DB cuối cùng có `status:"running"`.

### Tests for User Story 1 ⚠️

- [X] T017 [P] [US1] Tạo file `src/features/ai-agent/runtime/__tests__/runtime-orchestrator-ensure-running.test.ts`. Import `RuntimeOrchestrator` từ `@/features/ai-agent/runtime/runtime-orchestrator.server`. Viết helper build deps: in-memory `projectStateStore` (Map<projectId, DevRuntime>), fake `pm2Driver` (`describe` trả `{name, status, pid, ...}` từ map; `start` set map online + pid), fake `portAllocator.allocate` trả 12345.
- [X] T018 [US1] Trong file T017, thêm test happy path: gọi `orchestrator.startPreview({projectId, workspaceRoot, userId})` với `runInstall` mock resolve thành công, `healthCheck` spy. Assert: (1) `healthCheck` được gọi đúng 1 lần với URL match `/^http:\/\/127\.0\.0\.1:12345\/?$/` — KHÔNG bắt đầu bằng `https://`, KHÔNG chứa `publicHost`. (2) Sau khi await xong, `projectStateStore.readDevRuntime` trả `{status:"running", pid:999, port:12345, previewUrl: <whatever resolvePreviewTarget returns>}`.
- [X] T019 [US1] Thêm test "loopback health fail → status error, lastError 'did not become healthy'". `healthCheck` mock trả `false`. Sau await, DB `status:"error"`, `lastError` chứa "did not become healthy", `lastErrorTier:"system"`.

### Implementation for User Story 1

- [X] T020 [US1] Trong `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`, sửa điểm gọi healthCheck (line ~310 trong method `ensureRunning`): thay
  ```ts
  const healthy = await (this.deps.healthCheck ?? defaultHealthCheck)(previewUrl);
  ```
  bằng
  ```ts
  const loopbackUrl = `http://127.0.0.1:${port}/`;
  const healthy = await (this.deps.healthCheck ?? defaultHealthCheck)(loopbackUrl);
  ```
  Giữ nguyên signature `RuntimeOrchestratorDeps.healthCheck` và `defaultHealthCheck` — chỉ đổi argument truyền vào. Chạy T018, T019 phải pass.

**Checkpoint**: User Story 1 hoàn thành. Project mới start sẽ pass health check < 1s khi Vite ready, không phụ thuộc Cloudflare.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo coverage đầy đủ, lint sạch, không regression đường legacy.

- [X] T021 [P] Chạy `pnpm vitest run src/features/ai-agent/runtime` toàn bộ — confirm 14 test mới pass (4 trong T004-T007 cho US2, 8 trong T009-T016 cho US3, 2 trong T018-T019 cho US1) và không có test cũ vỡ.
- [X] T022 [P] Chạy `pnpm lint` (hoặc `pnpm exec eslint src/features/ai-agent/runtime`) — fix mọi lỗi lint mới phát sinh từ T002/T008/T020.
- [X] T023 [P] Chạy `pnpm tsc --noEmit` (type check toàn project) — confirm không có type error mới sau khi extract `mergeLiveStatus`.
- [ ] T024 Manual verify Scenario A của `quickstart.md` trên môi trường staging có `PREVIEW_PUBLIC_HOST`: tạo stuck state, deploy, quan sát UI heal trong < 3s. Document kết quả vào file `specs/020-fix-preview-runtime-desync/verify-log.md` (PASS/FAIL + thời gian heal đo được + DB row trước/sau).
- [ ] T025 Manual verify Scenario B của `quickstart.md`: init project mới, click Start, đo thời gian từ `pm2 start` đến UI badge `Running`. Append kết quả vào `verify-log.md`.

---

## Dependencies

```
T001 (smoke) ─┐
              ▼
            T002 (extract mergeLiveStatus) ─────────────────────┐
                                                                 │
                ┌────────────────┬────────────────┬──────────────┤
                ▼                ▼                ▼              ▼
              US2:             US3:             US1:           US1:
              T003 ──┐         T009 ──┐         T017 ──┐
              T004   │         T010   │         T018   │
              T005   │── T008  T011   │         T019   │── T020
              T006   │         T012   │
              T007 ──┘         T013   │
                               T014   │
                               T015   │
                               T016 ──┘
                ▼                ▼                ▼
              ┌────────────────────────────────────┐
              │         T021/T022/T023 (polish)     │
              └────────────────────────────────────┘
                ▼
              T024, T025 (manual verify on staging)
```

- T002 chặn toàn bộ test (mọi test import named function ở đó).
- T008 chặn các "upgrade" assertion (T004-T007). Các "no upgrade" / "kept" test (T009-T016) pass cả trước và sau T008 — viết trước cũng được nhưng dễ hiểu hơn nếu lùi sau T008.
- T020 chặn T018, T019.
- US1, US2, US3 độc lập với nhau ở mức implementation — sau T002 có thể chia 3 dev/3 stream song song.

## Parallel execution examples

Sau khi T002 xong, một developer có thể mở 3 PR-stream:

```
Stream A (US2 — MVP):  T003 → T004 → T005 → T006 → T007 → T008
Stream B (US3):        T009, T010, T011, T012, T013, T014, T015, T016 [P]
Stream C (US1):        T017 → T018, T019, T020
```

Sau khi cả 3 stream xong, gộp về 1 PR và chạy T021/T022/T023.

T009-T016 được mark `[P]` vì độc lập file? Không — chúng cùng file `runtime-orchestrator-merge-live-status.test.ts`. Tag `[P]` ở đây nghĩa là "viết trong vòng lặp song song không vướng dependency", không phải "edit khác file". Trong thực tế dev viết tuần tự cùng file. Tag giữ để biết logic-độc-lập.

## Implementation strategy

**MVP scope (deploy phase 1)**: T001 + T002 + Phase 3 (US2, T003-T008) + T021. Sau đó deploy. Project stuck hiện tại sẽ heal. Đây là 8 task, deploy gọn, value cao.

**Phase 2 (deploy sau)**: Phase 5 (US1, T017-T020) — ngăn ngừa stuck mới khi project init. Cộng thêm test T009-T016 (US3) cho coverage đầy đủ.

**Phase 3 (verify)**: T024, T025 — manual on staging; có thể làm trước khi merge nếu paranoid, hoặc post-merge kiểm tra production.

## Validation checklist

- [x] Mỗi task có Task ID (T001-T025) ✓
- [x] Mỗi task user-story phase có [Story] label ([US1]/[US2]/[US3]) ✓
- [x] Setup, Foundational, Polish phase KHÔNG có [Story] label ✓
- [x] Mọi task có file path cụ thể ✓
- [x] Tasks độc lập file được mark [P] ✓
- [x] Test viết trước implementation trong từng story ✓
- [x] Mỗi user story phase có Independent Test mô tả ✓
- [x] Dependency graph rõ ràng ✓
- [x] MVP scope identified (US2 = 8 tasks) ✓
