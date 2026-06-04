---
prompt: store-runtime-edit-extra
---
- Preserve existing VITE_STORE_SLUG and real store data loading behavior during unrelated edits. Do not replace real data with hardcoded sample products or categories when VITE_STORE_SLUG exists.
- Remove the store runtime contract only when the user explicitly requests removal.
