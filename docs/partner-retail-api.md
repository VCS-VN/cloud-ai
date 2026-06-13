# EpisCloud Partner API — Integration Guide

For partner backends (e.g. Monmi Retail) that provision and fund
EpisCloud customer accounts programmatically.

- **Base URL:** `https://dashboard.episcloud.com`
- **Auth:** `Authorization: Bearer pt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Content-Type:** `application/json` on every POST
- **Spec version:** v1 (2026-06-20)

---

## 1. Authentication

Every request carries your partner token in the `Authorization` header:

```
Authorization: Bearer pt_bb9d4afc5e4325dca97c1651c3875254
```

- The token is issued to you once by EpisCloud ops. Store it as a secret.
- It never expires until revoked. If it leaks, tell us immediately —
  we revoke + reissue.
- One token can manage any number of accounts you create.

A missing/invalid/revoked token returns:

```json
HTTP 401
{ "error": { "code": "unauthorized", "message": "invalid partner token" } }
```

---

## 2. Error format

All errors share one envelope:

```json
{ "error": { "code": "<snake_case>", "message": "<human readable>" } }
```

| HTTP | code | meaning |
|------|------|---------|
| 400 | `invalid_body` | malformed JSON or wrong field type |
| 400 | `invalid_amount` | `amount_micro_usd` ≤ 0 |
| 400 | `missing_reason` | topup without a `reason` |
| 400 | `missing_token` | payment method without `paypal_token_id` |
| 401 | `unauthorized` | bad/absent partner token |
| 403 | `forbidden` | the account is not owned by your partner token |
| 404 | `not_found` | unknown account / route |
| 502 | `aigw_unreachable` / `aigw_error` | transient downstream issue — **retry** |

> **Retry policy:** treat any `5xx` as retryable with exponential
> backoff. The two write operations below (`CreateAccount`,
> `TopupBalance`) are **idempotent**, so retrying is always safe.

---

## 3. Endpoints

All money values are **micro-USD** integers: `1_000_000` = $1.00.

### 3.1 Create an account

```
POST /v1/partner/accounts
```

```json
{
  "external_ref": "monmi-order-12345",   // YOUR id; the idempotency key
  "display_name": "Acme Pho Restaurant",
  "region_default": "oceania"            // optional, defaults to oceania
}
```

```json
HTTP 201
{
  "tenant_id": "ab175604475bdbd98baa740cf86de1a1",
  "slug": "monmi-order-12345-9fb28f",
  "display_name": "Acme Pho Restaurant",
  "status": "active",
  "created_at": 1781887111
}
```

- **`external_ref` is the idempotency key.** Re-POSTing with the same
  `external_ref` returns the existing account with **HTTP 200** (not a
  duplicate, not an error). Use your own stable order/customer id.
- Keep the returned `tenant_id` — it is the `{tenant_id}` path segment
  for every other call.

```bash
curl -X POST https://dashboard.episcloud.com/v1/partner/accounts \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"external_ref":"monmi-order-12345","display_name":"Acme Pho Restaurant"}'
```

---

### 3.2 Attach a payment card

```
POST /v1/partner/accounts/{tenant_id}/payment-methods
```

You must already hold a **PayPal vault token** (`pmt-…`) for the card.
This endpoint records the token against the account; it does **not**
run a 3-D Secure flow.

```json
{
  "paypal_token_id": "pmt-9eu3a8b...",
  "brand": "visa",
  "last4": "4242",
  "expiry_month": 12,        // integer 1-12
  "expiry_year": 2030,       // integer
  "paypal_customer_id": "",  // optional
  "default_method": true     // optional
}
```

```json
HTTP 201
{
  "payment_method_id": "c0b42a9092bb2e37690d8deee5ef5ff6",
  "default_method": true,
  "brand": "visa",
  "last4": "4242"
}
```

```bash
curl -X POST https://dashboard.episcloud.com/v1/partner/accounts/$TID/payment-methods \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"paypal_token_id":"pmt-9eu3a8b","brand":"visa","last4":"4242","expiry_month":12,"expiry_year":2030,"default_method":true}'
```

---

### 3.3 Mint an AI API key

```
POST /v1/partner/accounts/{tenant_id}/api-keys
```

```json
{
  "name": "retail-default",      // a label you choose
  "monthly_cap_cents": 0         // optional; 0 = no per-key cap
}
```

```json
HTTP 201
{
  "id": "f2290059f247951ac611995e1a327945",
  "raw_secret": "epis_sk_1d7226c83f7d599a2a629c51b46d2af9",
  "prefix": "epis_sk_1d7226c8…",
  "name": "retail-default",
  "monthly_cap_cents": 0,
  "created_at": 0
}
```

- **`raw_secret` is shown exactly once.** Store it the moment you
  receive it — it is not retrievable again. If lost, mint a new key.
- The account's first key seeds a **$1.00 trial credit** into the
  shared wallet automatically.
- This key authenticates the customer's AI calls against the EpisCloud
  AI gateway (`https://paas-ai.episcloud.com/v1/chat/completions`,
  OpenAI-compatible). All keys on an account draw from one shared
  wallet balance.

```bash
curl -X POST https://dashboard.episcloud.com/v1/partner/accounts/$TID/api-keys \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"name":"retail-default"}'
```

---

### 3.4 Top up balance

```
POST /v1/partner/accounts/{tenant_id}/balance/topup
```

```json
{
  "amount_micro_usd": 25000000,        // $25.00
  "currency": "USD",
  "reason": "monmi-order-12345",       // YOUR id; the idempotency key
  "external_payment_ref": ""           // optional, your payment ref
}
```

```json
HTTP 200
{
  "balance_micro_usd_after": 26000000,
  "reason": "partner:<your-partner-id>:monmi-order-12345",
  "credited_amount_micro_usd": 25000000
}
```

- **`reason` is the idempotency key.** Re-POSTing with the same
  `reason` does **not** double-credit — the response returns
  `credited_amount_micro_usd: 0` and the unchanged balance. Use a
  stable per-payment id.
- The credit is applied immediately to the account's shared AI wallet.

```bash
curl -X POST https://dashboard.episcloud.com/v1/partner/accounts/$TID/balance/topup \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"amount_micro_usd":25000000,"currency":"USD","reason":"monmi-order-12345"}'
```

---

### 3.5 Get current balance

```
GET /v1/partner/accounts/{tenant_id}/balance
```

```json
HTTP 200
{
  "tenant_id": "22e7691da5382043215359f023a6e75d",
  "balance_micro_usd": 26000000,
  "updated_at": 0
}
```

```bash
curl https://dashboard.episcloud.com/v1/partner/accounts/$TID/balance \
  -H "Authorization: Bearer $PT"
```

---

### 3.6 Balance history

```
GET /v1/partner/accounts/{tenant_id}/balance/history?limit=50&since_unix=0&type=all
```

| query | default | meaning |
|-------|---------|---------|
| `limit` | 50 | max events (1–500) |
| `since_unix` | 0 | only events at/after this unix-second |
| `type` | all | `topup`, `usage`, or `all` |

```json
HTTP 200
{
  "events": [
    {
      "type": "topup",
      "amount_micro_usd": 25000000,        // positive = credit
      "created_at": 1781889638,
      "reason": "partner:<id>:monmi-order-12345"
    },
    {
      "type": "usage",
      "amount_micro_usd": -1840,           // negative = AI debit
      "created_at": 1781889700,
      "alias": "episcloud-ai-pro",
      "prompt_tokens": 320,
      "completion_tokens": 210
    }
  ],
  "next_since_unix": 1781889638
}
```

- `topup` events are positive (credits you made).
- `usage` events are negative (AI consumption debits), with the model
  `alias` + token counts.
- Paginate with `next_since_unix`: pass it back as `since_unix` to get
  the next page.

```bash
curl "https://dashboard.episcloud.com/v1/partner/accounts/$TID/balance/history?limit=20&type=topup" \
  -H "Authorization: Bearer $PT"
```

---

## 4. End-to-end onboarding flow

```bash
PT="pt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
BASE="https://dashboard.episcloud.com"

# 1. Create (or fetch) the account by your order id
TID=$(curl -s -X POST $BASE/v1/partner/accounts \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"external_ref":"monmi-order-12345","display_name":"Acme Pho"}' \
  | jq -r .tenant_id)

# 2. Attach the customer's vaulted card
curl -s -X POST $BASE/v1/partner/accounts/$TID/payment-methods \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"paypal_token_id":"pmt-9eu3a8b","brand":"visa","last4":"4242","expiry_month":12,"expiry_year":2030,"default_method":true}'

# 3. Mint an AI key (store raw_secret NOW)
KEY=$(curl -s -X POST $BASE/v1/partner/accounts/$TID/api-keys \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"name":"retail-default"}' | jq -r .raw_secret)

# 4. Fund the wallet
curl -s -X POST $BASE/v1/partner/accounts/$TID/balance/topup \
  -H "Authorization: Bearer $PT" -H "Content-Type: application/json" \
  -d '{"amount_micro_usd":25000000,"currency":"USD","reason":"monmi-order-12345"}'

# 5. The customer can now call the AI gateway with their key:
curl -s https://paas-ai.episcloud.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"episcloud-ai-pro","messages":[{"role":"user","content":"Hi"}]}'

# 6. Check balance + history any time
curl -s $BASE/v1/partner/accounts/$TID/balance -H "Authorization: Bearer $PT"
curl -s "$BASE/v1/partner/accounts/$TID/balance/history" -H "Authorization: Bearer $PT"
```

---

## 5. Idempotency cheat-sheet

| Operation | Idempotency key | Repeat behaviour |
|-----------|-----------------|------------------|
| CreateAccount | `external_ref` | returns existing account, HTTP 200 |
| TopupBalance | `reason` | no double-credit, `credited_amount_micro_usd: 0` |
| MintAPIKey | none | each call mints a NEW key — don't blind-retry |
| AttachPaymentMethod | `paypal_token_id` | same token re-attaches harmlessly |

Always reuse YOUR stable identifiers (order id, payment id) as the
keys so a network retry never creates duplicates.

---

## 6. Notes & limits

- **Money unit:** every amount is micro-USD (`int64`). $1 = 1,000,000.
- **Currencies:** `currency` is recorded for your audit; the wallet is
  denominated in USD.
- **Card capture:** v1 takes pre-vaulted PayPal tokens only. There is no
  hosted 3-D Secure / card-entry UI in this API.
- **Rate / freshness:** balance updates are immediate. History is
  eventually consistent within a second.
- **Support:** integration questions →
  [partners@episcloud.com](mailto:partners@episcloud.com). Token issues
  / suspected leak → [security@episcloud.com](mailto:security@episcloud.com).
```
