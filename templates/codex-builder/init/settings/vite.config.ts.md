---
target: vite.config.ts
---
import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const previewProjectId = process.env.VITE_PROJECT_ID?.trim();
const previewDomain = process.env.VITE_PREVIEW_PUBLIC_HOST?.trim();
const previewHost = `${previewProjectId}-preview.${previewDomain}`;

export default defineConfig({
  plugins: [tanstackStart(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: [previewHost],
  },
});
