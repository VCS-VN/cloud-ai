# VPS Deployment Guide

Deploy the Cloud AI storefront builder on one VPS with:

- Web builder app on `127.0.0.1:3000`, exposed through `builder.myepis.cloud`.
- Preview router on `127.0.0.1:9000`, exposed through a separate preview Cloudflare Tunnel.
- Generated project dev servers on ports `10000-19999`, managed by PM2.
- Production workspaces stored outside the repository at `/var/bin/projects`.

## Target Architecture

```text
Internet
  │
  ├─ builder.myepis.cloud
  │    Cloudflare Tunnel: builder-tunnel
  │      → http://127.0.0.1:3000
  │          PM2 app: cloud-ai-builder
  │
  └─ <projectId>-preview.myepis.cloud
       Cloudflare DNS record per project
       Cloudflare Tunnel: preview-tunnel
         → http://127.0.0.1:9000
             Preview router
               → http://127.0.0.1:<10000-19999>
                   PM2 app: proj-<projectId>
```

Important boundaries:

- App does not manage `cloudflared` or systemd.
- DevOps manages both Cloudflare Tunnel services.
- App only creates/deletes preview DNS records through Cloudflare API.
- Local development must not enable Cloudflare preview mode unless `PREVIEW_PUBLIC_HOST` is set.

## VPS Prerequisites

Install system packages as root or sudo user:

```bash
sudo apt update
sudo apt install -y git curl build-essential
```

Install Node.js 22 LTS and pnpm through Corepack:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
corepack prepare pnpm@10.33.3 --activate
```

Install PM2 globally:

```bash
sudo npm install -g pm2
```

Create runtime folders for user `builder`:

```bash
sudo mkdir -p /var/bin/projects /var/log/cloud-ai/previews /etc/cloud-ai
sudo chown -R builder:builder /var/bin/projects /var/log/cloud-ai/previews /etc/cloud-ai
sudo chmod 750 /var/bin/projects /var/log/cloud-ai/previews
sudo chmod 700 /etc/cloud-ai
```

## Clone And Build

Run as user `builder`:

```bash
mkdir -p ~/apps
cd ~/apps
git clone <REPO_URL> cloud-ai
cd cloud-ai
pnpm install --frozen-lockfile
pnpm build:prod
```

Run database migration only if the database is already configured by ops:

```bash
set -a
. /etc/cloud-ai/.env
set +a
pnpm db:migrate
```

## Production Env

Create `/etc/cloud-ai/.env` owned by `builder` and mode `600`:

```bash
sudo touch /etc/cloud-ai/.env
sudo chown builder:builder /etc/cloud-ai/.env
sudo chmod 600 /etc/cloud-ai/.env
```

Minimum runtime env shape:

```bash
NODE_ENV=production
PORT=3000

# Existing app secrets and DB config managed by ops
DATABASE_URL=postgres://...
SESSION_SECRET=<at-least-32-chars>
OPENAI_API_KEY=...

# Project workspace storage
PROJECTS_ROOT=/var/bin/projects

# Production preview mode
PREVIEW_PUBLIC_HOST=myepis.cloud
PREVIEW_ROUTER_HOST=127.0.0.1
PREVIEW_ROUTER_PORT=9000
PREVIEW_PORT_MIN=10000
PREVIEW_PORT_MAX=19999
MAX_CONCURRENT_PREVIEWS=8
PREVIEW_TOKEN_TTL_SECONDS=900
PREVIEW_IDLE_TIMEOUT_SECONDS=1800
PREVIEW_LAZY_RESUME_TIMEOUT_SECONDS=30
PREVIEW_PROCESS_MAX_MEMORY=512M
PREVIEW_PM2_LOG_ROOT=/var/log/cloud-ai/previews
PREVIEW_TOKEN_SECRET=<at-least-32-chars>

# Cloudflare DNS management for preview records
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
CLOUDFLARE_TUNNEL_ID=<preview-tunnel-id>
```

Notes:

- `PREVIEW_PUBLIC_HOST=myepis.cloud` enables production preview mode.
- If `PREVIEW_PUBLIC_HOST` is unset, app stays in local preview mode and does not call Cloudflare DNS APIs.
- `CLOUDFLARE_TUNNEL_ID` must be the preview tunnel id, not the builder tunnel id.
- App reads `PREVIEW_TOKEN_SECRET`; if unset, it falls back to `SESSION_SECRET`.

## PM2 Builder App

Use this PM2 ecosystem content as an operator-local file, for example `/etc/cloud-ai/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "cloud-ai-builder",
      cwd: "/home/builder/apps/cloud-ai",
      script: "scripts/start-production.mjs",
      interpreter: "node",
      node_args: "--env-file=/etc/cloud-ai/.env",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
```

Start app:

```bash
cd /home/builder/apps/cloud-ai
pm2 start /etc/cloud-ai/ecosystem.config.cjs
pm2 save
```

Enable PM2 resurrect on reboot for user `builder`:

```bash
pm2 startup systemd -u builder --hp /home/builder
# Run the sudo command printed by PM2.
pm2 save
```

## Cloudflare Tunnel Setup

DevOps manages `cloudflared` and systemd. The app must not restart or spawn tunnel processes.

Use two tunnels:

1. `builder-tunnel` routes `builder.myepis.cloud` to `http://127.0.0.1:3000`.
2. `preview-tunnel` routes preview hosts to `http://127.0.0.1:9000`.

Example builder tunnel config:

```yaml
tunnel: <builder-tunnel-id>
credentials-file: /etc/cloudflared/<builder-tunnel-id>.json

ingress:
  - hostname: builder.myepis.cloud
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Example preview tunnel config:

```yaml
tunnel: <preview-tunnel-id>
credentials-file: /etc/cloudflared/<preview-tunnel-id>.json

ingress:
  - hostname: "*.myepis.cloud"
    service: http://127.0.0.1:9000
  - service: http_status:404
```

Create the builder DNS route once:

```bash
cloudflared tunnel route dns <builder-tunnel-name-or-id> builder.myepis.cloud
```

For preview DNS, the app creates one DNS record per project:

```text
<projectId>-preview.myepis.cloud CNAME <preview-tunnel-id>.cfargotunnel.com proxied=true
```

## Firewall

Do not expose app or preview ports publicly.

Recommended inbound firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

Keep these ports bound to loopback or blocked from public inbound traffic:

- `3000`: builder app
- `9000`: preview router
- `10000-19999`: generated project dev servers

Cloudflare Tunnel uses outbound HTTPS, so the VPS needs outbound network access.

## Deploy Updates

Current manual deploy flow:

```bash
cd /home/builder/apps/cloud-ai
git pull
pnpm install --frozen-lockfile
pnpm build:prod
set -a
. /etc/cloud-ai/.env
set +a
pm2 reload /etc/cloud-ai/ecosystem.config.cjs --only cloud-ai-builder --update-env
pm2 save
```

Future automation can run the same sequence from CI after merge.

## Runtime Checks

Check builder app:

```bash
pm2 status cloud-ai-builder
curl -I http://127.0.0.1:3000
```

Check preview router after app starts:

```bash
ss -ltnp | grep ':9000'
```

Check generated preview processes:

```bash
pm2 ls
pm2 logs cloud-ai-builder
ls -lah /var/log/cloud-ai/previews
```

Expected PM2 names:

- Main app: `cloud-ai-builder`
- Preview apps: `proj-<projectId>`

## Failure Modes

### Builder domain does not load

Check:

```bash
pm2 status cloud-ai-builder
curl -I http://127.0.0.1:3000
sudo systemctl status cloudflared-builder
```

Likely causes:

- PM2 app not running.
- `PORT=3000` missing from `/etc/cloud-ai/.env` or PM2 env.
- Builder tunnel DNS/ingress points to wrong port.

### Preview domain returns 404

Check:

```bash
pm2 logs cloud-ai-builder
ss -ltnp | grep ':9000'
```

Likely causes:

- `PREVIEW_PUBLIC_HOST` unset, so production preview router is disabled.
- Preview DNS record not created or points to wrong tunnel id.
- Preview token missing/expired.
- Project runtime is disabled or deleted.

### Preview starts locally but not through domain

Check:

```bash
pm2 ls
ls -lah /var/log/cloud-ai/previews
```

Likely causes:

- `CLOUDFLARE_TUNNEL_ID` is builder tunnel id instead of preview tunnel id.
- Preview tunnel ingress does not include `*.myepis.cloud`.
- Generated Vite dev server did not receive `VITE_PREVIEW_HOST`.

### Project files disappear after deploy

Check:

```bash
grep PROJECTS_ROOT /etc/cloud-ai/.env
ls -lah /var/bin/projects
```

Expected:

- `PROJECTS_ROOT=/var/bin/projects` is set.
- `/var/bin/projects` is owned by `builder`.
- No production project data is stored inside the repository checkout.
