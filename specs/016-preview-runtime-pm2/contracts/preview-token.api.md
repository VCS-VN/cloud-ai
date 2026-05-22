# Contract: Preview Token

## Token Issuance

Only the main app can issue preview tokens, and only after normal project authorization succeeds.

## Claims

```json
{
  "iss": "cloud-ai",
  "aud": "preview",
  "sub": "user-id",
  "projectId": "project-id",
  "iat": 1760000000,
  "exp": 1760000900,
  "jti": "uuid"
}
```

## Cookie

| Attribute | Production |
|---|---|
| Name | `preview_token` |
| Domain | `.myepis.cloud` |
| Path | `/` |
| HttpOnly | true |
| Secure | true |
| SameSite | `Lax` |
| Max-Age | 900 seconds |

## Validation

- Signature valid.
- `aud=preview`.
- `projectId` claim equals host project id.
- `sub` still has project access in main app.
- Not expired.
- Token not revoked if revocation list is enabled.
