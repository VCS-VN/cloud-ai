# Preview Runtime

This module owns generated-project preview runtime infrastructure.

## Local Mode

When `PREVIEW_PUBLIC_HOST` is unset, previews use `http://127.0.0.1:<port>` directly. No Cloudflare DNS, Cloudflare Tunnel, or internal preview router is required.

## Production Mode

When `PREVIEW_PUBLIC_HOST=myepis.cloud`, each project gets `<projectId>-preview.myepis.cloud`. Cloudflare Tunnel is managed by devops and forwards wildcard traffic to `127.0.0.1:9000`. The app starts the internal preview router once and proxies requests to the project's allocated local port.

## Ownership

- `pm2-driver.server.ts`: pm2 process operations.
- `port-allocator.server.ts`: preview port allocation from 10000-19999.
- `cloudflare-dns.server.ts`: per-project DNS create/delete with retry.
- `preview-router.server.ts`: production Host-based HTTP/WS proxy.
- `runtime-orchestrator.server.ts`: background install/start state machine.

## Legacy

`process-manager.server.ts` is retained only for the legacy `RuntimeService.runErrorFixLoop` and presence sweeper integration. The new orchestrator and reconciler do not consume it; remove the legacy module after the legacy fix-loop migrates to the orchestrator.
