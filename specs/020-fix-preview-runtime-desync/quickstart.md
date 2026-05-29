# Quickstart: Verify preview runtime desync fix

**Feature**: 020-fix-preview-runtime-desync
**Audience**: developer/operator running through the fix locally or on staging before production rollout

## What you are verifying

1. Một project đang stuck (`status:error`/`stopped` + pm2 online) tự về `running` trong < 3s sau khi mergeLiveStatus mới được nạp vào server.
2. Một project init mới + click Start preview chuyển sang `running` không phụ thuộc Cloudflare/DNS propagation.
3. Project đã teardown (`enabled:false`) KHÔNG bị "hồi sinh" dù pm2 còn process tồn lưu.

Không có DB migration, không có env var mới — chỉ deploy code.

## Pre-conditions

- Branch `020-fix-preview-runtime-desync` đã được build và deploy lên môi trường có `PREVIEW_PUBLIC_HOST` được set (production-like).
- Có ít nhất một project mà bạn có thể init/quan sát qua UI.
- Có shell access vào host để inspect pm2 nếu cần (`pm2 list`, `pm2 describe proj-<projectId>`).
- DB access read-only (để confirm DevRuntime row state) — optional nhưng giúp debug.

## Scenario A — Auto-heal cho project đang stuck

### Setup repro state (skip nếu bạn đã có project stuck sẵn)

1. Trên môi trường staging, init một project, đợi flow generate xong.
2. Trước khi deploy fix: trên mạng, gây delay/timeout cho subdomain `${projectId}-preview.${PREVIEW_PUBLIC_HOST}` (ví dụ tạm thời tắt route Cloudflare tunnel cho host pattern này).
3. Click Start preview trên UI. Server sẽ chạy `ensureRunning` → pm2 start thành công → `waitForPreviewHealthy(publicUrl)` timeout 45s → DB rơi vào `status:error`, `lastError: "Preview process started but did not become healthy."`.
4. Bật lại Cloudflare route. Lúc này pm2 vẫn online, DB vẫn `error`, UI vẫn hiện nút Start. Đây là stuck state cần fix.

### Verify auto-heal

1. Deploy build từ branch này lên cùng môi trường (rolling restart Node app).
2. Mở UI project ở mode preview. Để tab tự poll, không bấm gì.
3. Trong **≤ 3s** kể từ khi UI lần đầu poll `getDevRuntimeState` sau deploy, badge phải chuyển từ "Error" / "Stopped" sang "Running" và iframe load storefront.

### Pass criteria

- UI badge: `Running` ✓
- Iframe render: storefront ✓
- DB query (optional): `dev_runtime.status = 'running'`, `dev_runtime.lastError IS NULL`, `dev_runtime.lastErrorTier IS NULL`
- Không có request thủ công (refresh, restart server, xoá project) trong khoảng heal

### Pitfalls

- Nếu UI không heal: kiểm tra DB row có `enabled:true`, `previewUrl IS NOT NULL`, `port IS NOT NULL`. Thiếu bất kỳ điều nào đều khiến nhánh upgrade bypass (thiết kế).
- Nếu UI heal nhưng iframe trống: vấn đề khác (token cookie / Cloudflare tunnel) — không thuộc phạm vi fix này.

## Scenario B — Project init mới + Start preview

1. Trên môi trường có Cloudflare tunnel hoạt động bình thường.
2. Tạo project mới qua UI; đợi init flow chạy xong.
3. Click Start preview.
4. Quan sát badge.

### Pass criteria

- Badge chuyển `Starting` → `Running` trong vài giây sau khi pm2 báo online (không cần đợi 45s timeout).
- Iframe load storefront.
- Server log không có dòng `Preview process started but did not become healthy.` cho project này.

### Verify loopback health gate đã hoạt động

Trên host, log của ensureRunning (nếu thêm log debug tạm) sẽ cho thấy URL được probe là `http://127.0.0.1:<port>/`, không phải `https://...`. Hoặc grep stderr/stdout xem có request đến Cloudflare khi probe không (không nên có).

## Scenario C — Project đã teardown không bị hồi sinh

1. Tạo project mới + Start preview thành công (đảm bảo có pm2 process).
2. Trên UI, xoá project (action `deleteProject` → `runtimeOrchestrator.teardownPreview` → set `enabled:false`, `pm2.delete`).
3. **Trong cửa sổ race trước khi pm2.delete hoàn tất**: nếu bạn có khả năng dừng `pm2.delete` (hoặc xảy ra crash giữa chừng) sao cho `enabled:false` đã set vào DB nhưng pm2 process vẫn online — đây là edge case.
4. Trigger `getDevRuntimeState` cho project đó (gọi qua API hoặc poll UI nếu page chưa unmount).

### Pass criteria

- Trạng thái trả về KHÔNG phải `running`. Có thể là `stopped` hoặc giữ `running` cũ từ trước teardown — quan trọng là logic upgrade mới KHÔNG kích hoạt vì `enabled:false`.
- Reconciler ở chu kỳ kế tiếp sẽ pm2.delete process tồn lưu, sau đó mọi state về sạch.

## Smoke test command

Từ project root:

```sh
pnpm test src/features/ai-agent/runtime/__tests__
```

Cần thấy:
- `runtime-orchestrator-merge-live-status.test.ts`: ≥ 12 case pass (truth table trong plan).
- `runtime-orchestrator-ensure-running.test.ts`: 2 case pass (happy path loopback + health fail).

## Rollback

Revert single commit trên branch. Không có DB migration, không có biến env, không có trạng thái persisted mới. Auto-heal sẽ ngừng — các project hồi sinh tạm thời sẽ trượt lại `error/stopped` ở lần `mergeLiveStatus` kế tiếp khi gặp downgrade trigger (pm2 restart hoặc memory limit hit).
