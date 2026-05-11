# Contract: Generated HTTP Client Baseline

## Scope

Applies to newly generated storefront projects created from project detail initialization.

## Generated Files

- `src/services/http/client.ts`: shared HTTP client and interceptor/error handling helpers.
- `.env.example`: safe template listing required HTTP environment fields.
- `package.json`: contains `axios` under dependencies at version `^1.16.0`.

## Required Behavior

1. Project-detail HTTP actions import the shared client instead of creating per-file request clients.
2. Requests use environment-configured backend endpoint values.
3. Requests include authenticated context when local auth tokens are available.
4. Unauthorized responses attempt one recovery flow before retrying the original request.
5. Unauthorized recovery failures clear local auth state.
6. Non-authentication failures are normalized into a stable application error shape.
7. The generated client does not import or call host preview services.

## Acceptance Checks

- Generated file tree contains `src/services/http/client.ts`.
- Generated package manifest contains `dependencies.axios` equal to `^1.16.0`.
- Generated environment template contains the same key consumed by the client for the API endpoint.
- Existing preview start, stop, status, and presence flows remain unchanged by this feature.
