---
layer: CHECKOUT_PAGE
warning: >
  Route thanh toán. Spec hành vi (form, placeholder order). Gửi nguyên văn.
---
src/routes/checkout.tsx - createFileRoute('/checkout'), shipping form (Input+Label) with react-hook-form+zod, Place Order Button shows toast.success placeholder; do NOT persist orders.

Checkout input UX:
- Inputs MUST be empty by default and show example content through placeholder props only.
- Do NOT seed form defaultValues with fake customer data such as "John Doe", "2000", phone numbers, emails, or addresses.
- Use descriptive placeholders for each field, for example: name/full name, email address, phone number, street address, suburb/city, state, and postal code.
- Postal code and name examples belong in placeholder text, not in the input value.
