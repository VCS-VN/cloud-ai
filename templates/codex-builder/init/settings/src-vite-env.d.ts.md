---
target: src/vite-env.d.ts
---
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORE_SLUG?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
