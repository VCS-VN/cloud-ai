# Contract: Production Preview Router

## Scope

The router listens on `127.0.0.1:9000` in production mode only. Cloudflare Tunnel forwards preview subdomain traffic to it.

## Host Matching

```text
Host: <projectId>-preview.myepis.cloud
```

Rules:

- Extract `projectId` from the left-most label.
- Reject hosts outside the configured preview public host.
- Reject unknown, deleted, disabled, or unauthorized projects.

## HTTP Request Flow

1. Validate host format.
2. Verify `preview_token` cookie.
3. Confirm token `projectId` matches requested host.
4. Lookup runtime intent.
5. If process is stopped but `enabled=true`, perform lazy resume with request dedupe.
6. Wait up to 30 seconds for health readiness.
7. Proxy request to `http://127.0.0.1:<port>`.
8. Update `lastAccessedAt` on successful authorization.

## WebSocket Upgrade Flow

Same validation and lazy-resume rules as HTTP. On success, forward upgrade to `ws://127.0.0.1:<port>`.

## Responses

| Status | Meaning |
|---:|---|
| 200-599 | Proxied response from project runtime |
| 401 | Missing/invalid/expired preview token |
| 403 | Token valid but unauthorized for project |
| 404 | Unknown/deleted/disabled project or invalid host |
| 503 | Lazy resume timed out or runtime unavailable |

## Security Rules

- Never proxy before token verification.
- Never proxy requests for deleted projects.
- Never expose internal port in error body.
- Apply same authorization to HTTP and websocket upgrades.
