# Quickstart: Production Preview Runtime with Project Isolation

## Local Development

1. Install dependencies.
2. Leave `PREVIEW_PUBLIC_HOST` unset.
3. Optionally set `PROJECTS_ROOT`; otherwise local projects use `./projects`.
4. Start app normally.
5. Create/init a storefront.
6. Verify preview iframe uses `http://127.0.0.1:<port>` and no Cloudflare DNS calls occur.

Expected local behavior:

- Port allocated from 10000–19999.
- Vite binds `127.0.0.1`.
- No internal router required.
- No Cloudflare token required.

## Production VPS Setup

Devops prerequisites:

1. Install and configure `cloudflared` as a systemd service.
2. Configure Cloudflare Tunnel ingress to send preview traffic to:

```yaml
ingress:
  - hostname: "*.myepis.cloud"
    service: http://127.0.0.1:9000
  - service: http_status:404
```

3. Create a Cloudflare API token with Zone DNS Edit permission for `myepis.cloud`.
4. Ensure production workspace root exists:

```bash
sudo mkdir -p /var/bin/projects
sudo chown -R <app-user>:<app-group> /var/bin/projects
```

5. Configure app environment:

```bash
NODE_ENV=production
PREVIEW_PUBLIC_HOST=myepis.cloud
PROJECTS_ROOT=/var/bin/projects # optional; production default is /var/bin/projects
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
CLOUDFLARE_TUNNEL_ID=...
MAX_CONCURRENT_PREVIEWS=8
PREVIEW_PORT_MIN=10000
PREVIEW_PORT_MAX=19999
PREVIEW_TOKEN_TTL_SECONDS=900
PREVIEW_IDLE_TIMEOUT_SECONDS=1800
PREVIEW_LAZY_RESUME_TIMEOUT_SECONDS=30
PREVIEW_PROCESS_MAX_MEMORY=512M
```

## Production Smoke Test

1. Deploy app and start it under pm2.
2. Initialize a storefront project.
3. Confirm UI shows install/start state through polling.
4. Confirm Cloudflare DNS record exists:

```text
<projectId>-preview.myepis.cloud CNAME <tunnelId>.cfargotunnel.com proxied=true
```

5. Open project page while signed in and verify iframe loads.
6. Open preview subdomain without session/token and verify request is denied.
7. Restart app process and verify preview state still reflects pm2 status.
8. Open more than 8 previews and verify LRU stopping/resume behavior.
9. Delete a project and verify pm2 process, DNS record, port assignment, and workspace folder are removed while DB row is soft-deleted.

## Generated Project Vite Template Requirement

Generated storefront `vite.config.ts` must read runtime env:

```ts
server: {
  host: "127.0.0.1",
  port: Number(process.env.VITE_PORT) || 5173,
  strictPort: true,
  hmr: process.env.VITE_PREVIEW_HOST
    ? { protocol: "wss", host: process.env.VITE_PREVIEW_HOST, clientPort: 443 }
    : true,
  allowedHosts: process.env.VITE_PREVIEW_HOST
    ? [process.env.VITE_PREVIEW_HOST]
    : "all",
}
```

## Failure Drill

- Stop a pm2 project process manually; UI should reflect stopped/missing state on next poll.
- Occupy an assigned port with another process; startup should fail with system tier error.
- Break Cloudflare API token; DNS create/delete should retry 3 times then mark operator attention required.
- Remove preview cookie; router must return 401 before proxying.
