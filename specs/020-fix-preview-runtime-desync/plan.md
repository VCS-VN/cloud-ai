# Implementation Plan: Fix preview runtime state desync

**Branch**: `020-fix-preview-runtime-desync` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/020-fix-preview-runtime-desync/spec.md`

## Summary

Hai thay đổi nhắm vào `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`:

1. **Loopback health gate** — `ensureRunning` đang gọi `waitForPreviewHealthy(previewUrl)` với URL Cloudflare công khai (`https://${projectId}-preview.${publicHost}`). Đổi thành URL loopback `http://127.0.0.1:${port}/` để loại bỏ phụ thuộc tunnel/DNS/cookie ra khỏi quyết định "preview đã sẵn sàng".
2. **Symmetric `mergeLiveStatus`** — hiện chỉ downgrade (`running` → `stopped/error` khi pm2 không online). Thêm nhánh upgrade: khi `enabled === true` và `pm2.status === "online"` và DB có cả `previewUrl` lẫn `port` mà DB.status không phải `running` → trả về `running`, kèm `pid` từ pm2 và xoá `lastError`/`lastErrorTier`.

UI hiện hành đã poll `getDevRuntimeState` mỗi 3s (running) / 10s (idle). Sau deploy, mỗi project đang stuck sẽ tự được mergeLiveStatus nâng cấp ở chu kỳ poll kế tiếp — không cần migration, không thay đổi UI, không thay đổi tầng router/token/DNS.

## Technical Context

**Language/Version**: TypeScript trên Node 20 (ESM, TanStack Start)
**Primary Dependencies**: `pm2` (process control), `axios` (health probe), `http-proxy` (preview-router), `jose` (preview JWT) — không thêm dependency mới
**Storage**: Postgres (DevRuntime nằm trong cột `dev_runtime` của bảng `project_states`, persist qua `ProjectStateStore`)
**Testing**: Vitest, pattern `src/**/__tests__/**/*.test.ts` (xem `vitest.config.ts`)
**Target Platform**: Node server thường trú; production có `PREVIEW_PUBLIC_HOST` (Cloudflare tunnel + per-project subdomain), dev local không có publicHost
**Project Type**: Single TypeScript project (frontend + server functions hợp nhất qua TanStack Start)
**Performance Goals**: UI poll cycle 3s; loopback health probe phải `< 1s` round-trip khi Vite ready (giới hạn cứng `waitForPreviewHealthy` vẫn 45s nhưng thực tế là ms)
**Constraints**: Không thay đổi schema DB, không thay đổi public API server functions (`getDevRuntimeState`, `startPreview`), không thay đổi UI components
**Scale/Scope**: Sửa 1 file production + 2 file test mới; không touch UI; không touch reconciler/router

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú |
|---|---|---|
| I. Code flow rõ ràng | ✅ Pass | Bug đã được trace toàn bộ flow qua phiên grill; thay đổi cô lập trong runtime-orchestrator. |
| II. Test cho business rule | ✅ Pass | Truth table 4 chiều cho `mergeLiveStatus` + happy path `ensureRunning` được liệt kê dưới. |
| III. API lỗi nhất quán | ✅ N/A | Không thêm/sửa API endpoint, không đổi format error. |
| IV. Không over-engineer | ✅ Pass | Hai thay đổi tối thiểu; không thêm endpoint `/__health`, không thêm worker, không migration script. |
| V. UX/Validation/Design | ✅ N/A | Không sửa UI. UI hiện hành phản ứng đúng khi state trả về đúng. |
| VI. Bảo mật role/permission | ✅ Pass | Loopback probe chạy trên server nội bộ, không exposed ra ngoài. Không bypass token cookie ở public flow. |
| VII. Code Review (graph) | — | Sẽ áp dụng ở giai đoạn review. |
| VIII. Format ESLint | — | Sẽ áp dụng trước commit. |
| IX. JSON column type | ✅ N/A | Không sửa schema. `dev_runtime` đã có sẵn dạng `json`. |
| X. Import alias `@/` | ✅ Pass | File chỉnh sửa đã dùng alias hoặc same-folder; test mới sẽ dùng `@/features/...`. |

→ Không có violation cần ghi vào Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/020-fix-preview-runtime-desync/
├── plan.md                                # This file
├── spec.md                                # /speckit-specify output
├── quickstart.md                          # Verification steps post-deploy
└── checklists/
    └── requirements.md                    # Quality checklist
```

### Source Code (repository root)

```text
src/features/ai-agent/runtime/
├── runtime-orchestrator.server.ts         # MODIFY: loopback health, symmetric mergeLiveStatus
├── preview-health.server.ts               # UNCHANGED: waitForPreviewHealthy reused as-is
├── pm2-driver.server.ts                   # UNCHANGED
├── preview-router.server.ts               # UNCHANGED
├── runtime-reconciler.server.ts           # UNCHANGED (vẫn dọn pm2 cho enabled:false ở boot)
└── __tests__/
    ├── runtime-orchestrator-merge-live-status.test.ts   # NEW
    └── runtime-orchestrator-ensure-running.test.ts      # NEW

src/server/services/project-service.ts     # UNCHANGED (đã delegate sang runtimeOrchestrator)
src/routes/projects/$projectId.tsx         # UNCHANGED (UI poll logic giữ nguyên)
```

**Structure Decision**: Single project. Toàn bộ thay đổi nằm trong domain `runtime` của AI Agent. Test mới đặt vào `__tests__` cạnh module (đúng convention `vitest.config.ts`).

---

## Phase 0 — Research / Codebase Findings

### F1. `mergeLiveStatus` hiện tại bất đối xứng (root cause stuck state)

`runtime-orchestrator.server.ts:342-356`:

```ts
private mergeLiveStatus(runtime: DevRuntime, pm2: PreviewPm2Process): DevRuntime {
  if (runtime.status === "running" && pm2.status !== "online") {
    return { ...runtime, status: pm2.status === "missing" ? "stopped" : "error", ... };
  }
  if (runtime.status === "running" && pm2.status === "online" && runtime.previewUrl && runtime.port) {
    return { ...runtime, status: "running", pid: pm2.pid };
  }
  return runtime;  // ← LEAK: DB stopped/error + pm2 online → trả nguyên DB, không heal
}
```

→ Thêm nhánh upgrade thoả các điều kiện đã chốt ở Q5/A + Q6/A + Q8/A.

### F2. Health gate dùng URL công khai (root cause first-fail)

`runtime-orchestrator.server.ts:308-310`:

```ts
const process = await this.deps.pm2Driver.start({...});
const healthy = await (this.deps.healthCheck ?? defaultHealthCheck)(previewUrl);
//                                                                 ^ Cloudflare URL
```

`previewUrl` đến từ `resolvePreviewTarget` (line 333-340): khi có `publicHost` → `https://${projectId}-preview.${publicHost}`; không thì `http://127.0.0.1:${port}`. Production luôn rơi vào nhánh đầu.

`waitForPreviewHealthy` dùng axios không có cookie → preview-router 401 → response status 401 < 500 → trả `true` (best case). Worst case: DNS chưa propagate → axios timeout → trả `false` sau 45s → `ensureRunning` set `status:"error"`.

→ Thay bằng `http://127.0.0.1:${port}/` để probe Vite trực tiếp ở loopback, không qua tunnel.

### F3. Đường dùng song song với `RuntimeService` đã legacy

`runtime-service.server.ts:284` cũng gọi `waitForPreviewHealthy(previewUrl)`. Tuy nhiên `RuntimeService` chỉ được dùng ở fallback path trong `project-service.ts` khi `!runtimeOrchestrator` — production luôn có orchestrator (`project-services.ts:96`). Không sửa file này để giữ surgical scope (mục 3 AGENTS.md). Nếu muốn fix luôn, mở ticket riêng.

### F4. Reconciler đã có rule upgrade ngược tương tự

`runtime-reconciler.server.ts:85-92`: nếu pm2 online + DB.status != running + DB có previewUrl + port → set `status:"running"`. Reconciler chỉ chạy 1 lần ở bootstrap (`runtimeBootstrapped` flag trong `project-services.ts`). Logic ta thêm vào `mergeLiveStatus` chính là phiên bản "live, mỗi lần read" của rule này — đảm bảo healing không phụ thuộc bootstrap.

### F5. UI logic an toàn để auto-heal

`$projectId.tsx:401-411`: `runtimeQuery` poll mỗi 3s khi running, 3s khi idle (xem `refetchInterval`). Sau khi `mergeLiveStatus` upgrade, poll kế tiếp sẽ thấy `status:"running"` → `previewReady` true → render iframe. Không cần thay UI.

### F6. Test infrastructure

- `vitest.config.ts` include `src/**/__tests__/**/*.test.ts`
- Thư mục `src/features/ai-agent/runtime/__tests__/` đã tồn tại (rỗng) — đặt test mới vào đây
- Không có integration test sẵn cho `runtime-orchestrator` → thêm unit test mới là duy nhất

---

## Phase 1 — Design

### D1. Symmetric `mergeLiveStatus`

```ts
private mergeLiveStatus(runtime: DevRuntime, pm2: PreviewPm2Process): DevRuntime {
  // Downgrade: DB nói running nhưng pm2 không online
  if (runtime.status === "running" && pm2.status !== "online") {
    return {
      ...runtime,
      status: pm2.status === "missing" ? "stopped" : "error",
      pid: null,
      lastError: pm2.status === "missing"
        ? "Preview process is not running."
        : "Preview process is not healthy.",
      lastErrorTier: "system",
    };
  }
  // Confirm running
  if (runtime.status === "running" && pm2.status === "online" && runtime.previewUrl && runtime.port) {
    return { ...runtime, status: "running", pid: pm2.pid };
  }
  // NEW — Upgrade: pm2 online + DB có đủ thông tin truy cập + project được phép chạy
  if (
    runtime.enabled &&
    pm2.status === "online" &&
    runtime.previewUrl &&
    runtime.port &&
    runtime.status !== "running"
  ) {
    return {
      ...runtime,
      status: "running",
      pid: pm2.pid,
      lastError: null,
      lastErrorTier: null,
    };
  }
  return runtime;
}
```

Quyết định ánh xạ vào nhánh upgrade:
- **Q5/A**: nhánh upgrade sửa root cause stuck state.
- **Q6/A**: clear `lastError` + `lastErrorTier` để UI không hiện lỗi cũ.
- **Q8/A**: yêu cầu `runtime.enabled` để không hồi sinh project đã teardown.
- Thứ tự nhánh: downgrade trước, confirm-running giữa, upgrade cuối — đảm bảo không "self-overwrite" cho case running ổn định.

### D2. Loopback health gate

Đổi signature gọi để truyền cả `previewUrl` (cho debug/log) lẫn `port` (cho probe). Đơn giản nhất: build URL loopback ngay tại điểm gọi.

```ts
// trước:
const healthy = await (this.deps.healthCheck ?? defaultHealthCheck)(previewUrl);

// sau:
const loopbackUrl = `http://127.0.0.1:${port}/`;
const healthy = await (this.deps.healthCheck ?? defaultHealthCheck)(loopbackUrl);
```

Signature `healthCheck?: (url: string) => Promise<boolean>` giữ nguyên, vẫn nhận URL. `defaultHealthCheck` không cần đổi. Hệ quả: không thay đổi public type của `RuntimeOrchestratorDeps` — tránh ảnh hưởng test mock có sẵn (nếu có).

Lưu ý: `pm2-driver.server.ts:94` đã start Vite với `--host 127.0.0.1 --port ${port}` → loopback luôn reachable khi Vite ready. Vite mặc định không enforce host check ở loopback, không cần `Host` header giả.

### D3. Không thay đổi nào khác

- `defaultHealthCheck` và `waitForPreviewHealthy` giữ nguyên (dùng axios, `< 500 → true`, timeout 45s).
- Reconciler giữ nguyên — nó vẫn xử lý `enabled:false` → `pm2.delete` và một-lần-bootstrap upgrade.
- `RuntimeService` (đường legacy) không touch.
- UI/server functions/router/token service không touch.

---

## Phase 2 — Test Plan

### T1. `runtime-orchestrator-merge-live-status.test.ts`

Truth table 4 chiều: `DB.status` × `pm2.status` × `DB.enabled` × `(previewUrl, port)`. Chỉ liệt kê các tổ hợp có ý nghĩa nghiệp vụ (không brute-force).

| # | DB.status | pm2 | enabled | preview/port | Expected |
|---|---|---|---|---|---|
| 1 | running | online | true | có | `running`, pid pm2 (confirm path) |
| 2 | running | missing | true | có | `stopped`, pid null, lastError "not running" |
| 3 | running | errored | true | có | `error`, pid null, lastError "not healthy" |
| 4 | error | online | true | có | **upgrade → running**, pid pm2, lastError null, lastErrorTier null |
| 5 | stopped | online | true | có | **upgrade → running** |
| 6 | starting | online | true | có | **upgrade → running** |
| 7 | error | online | true | thiếu previewUrl | giữ nguyên (chưa đủ điều kiện UI render) |
| 8 | error | online | true | thiếu port | giữ nguyên |
| 9 | error | online | **false** | có | **giữ nguyên** (Q8 invariant) |
| 10 | stopped | offline | true | có | giữ nguyên (pm2 không online) |
| 11 | installing | online | true | có | upgrade → running (status != running thoả điều kiện) |
| 12 | running | online | true | thiếu previewUrl | giữ nguyên (confirm path không match) |

Mỗi test gọi trực tiếp `mergeLiveStatus` qua một thin wrapper hoặc qua `getRuntimeState` mocked đầy đủ deps. Vì `mergeLiveStatus` là `private`, hai lựa chọn:
- **A.** Test qua `getRuntimeState` (public) bằng cách mock `projectStateStore.readDevRuntime` + `pm2Driver.describe`. Thực tế hơn nhưng verbose.
- **B.** Đổi `mergeLiveStatus` thành `static export function mergeLiveStatus(...)` (vẫn re-export trên class nếu cần), test trực tiếp.

→ Chọn **B** vì hàm thuần (không state, không IO). Export thêm `mergeLiveStatus` như named export ở cuối file. Class method vẫn delegate sang named function cho backward compat. Tăng testability không over-engineer.

### T2. `runtime-orchestrator-ensure-running.test.ts`

Kịch bản happy path:

1. Mock `projectStateStore` (in-memory map), `pm2Driver` (luôn `online` sau `start`), `portAllocator` (trả 12345), `healthCheck` (kiểm tra URL nhận được).
2. Gọi `orchestrator.scheduleEnsureRunning({ projectId, workspaceRoot, userId })`.
3. **Assertion 1**: `healthCheck` được gọi với URL loopback `http://127.0.0.1:12345/` — KHÔNG phải URL có scheme `https://` hay có `publicHost`.
4. **Assertion 2**: Sau khi promise resolve, DB cuối cùng có `status: "running"`, `pid: <pm2 pid>`, `previewUrl: <whatever resolvePreviewTarget returns>`, `port: 12345`.

Kịch bản health fail:

1. Mock `healthCheck` trả `false`.
2. Gọi `scheduleEnsureRunning`.
3. **Assertion**: DB cuối cùng `status: "error"`, `lastError` chứa "did not become healthy", `lastErrorTier: "system"`. (Để đảm bảo loopback health vẫn là gate hợp lệ — không bỏ check.)

### T3. Regression / không cần thêm

Các test integration sẵn (nếu có) cho `getDevRuntimeState`/`startPreview` không có trong codebase hiện tại. Không thêm trong scope này — feature spec yêu cầu `Existing integration tests for runtime-orchestrator continue to pass`, mà tập đó hiện rỗng.

### T4. Manual verify (ghi vào quickstart.md)

Sẽ tạo riêng `quickstart.md` mô tả:
- Cách repro stuck state trên một project hiện tại
- Cách deploy fix
- Quan sát UI tự upgrade trong < 3s

---

## Phase 3 — Rollout

1. **Implement** trên branch `020-fix-preview-runtime-desync`:
   - Sửa `mergeLiveStatus` (export named + giữ class method).
   - Sửa điểm gọi healthCheck để dùng loopback URL.
   - Viết 2 file test trong `__tests__/`.
2. **Lint + test**: `pnpm lint` + `pnpm test src/features/ai-agent/runtime` (đảm bảo cả 2 file test mới pass + phần khác không vỡ).
3. **Deploy**: production deploy như bình thường — không có DB migration, không có biến env mới.
4. **Auto-heal observation**: trong vòng < 10s sau deploy (1 poll cycle UI mỗi 3s + propagation), các project stuck `enabled:true + status:error/stopped + pm2 online + previewUrl + port` sẽ tự về `running`.
5. **Monitor**: quan sát log preview-router 401/503 không tăng (đảm bảo loopback không thay đổi side effect tầng router); quan sát `agent_phase_failed` cho `runtime_schedule` giảm xuống.

## Complexity Tracking

> Không có violation cần justify. Bảng trống cố ý.
