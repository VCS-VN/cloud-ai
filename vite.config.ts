import { resolve } from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { nitro } from "nitro/vite";

export default defineConfig({
  build: {
    sourcemap: true,
  },
  ssr: {
    external: ['firebase-admin'],
  },
  plugins: [
    tanstackStart(),
    react(),
    nitro(),
    VitePWA({
      registerType: "autoUpdate",
      outDir: "dist/client",
      includeAssets: ["pwa-icon.svg"],
      workbox: {
        navigateFallback: null,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        runtimeCaching: [],
      },
      manifest: {
        name: "Cloud AI",
        short_name: "Cloud AI",
        description: "Create apps and websites by chatting with AI.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#101216",
        theme_color: "#101216",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@app": resolve(__dirname, "app"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
