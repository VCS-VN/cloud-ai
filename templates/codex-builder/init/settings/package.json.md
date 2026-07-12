---
target: package.json
---
{
  "name": "generated-storefront",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsr generate && vite dev",
    "build": "tsr generate && vite build && tsc --noEmit",
    "typecheck": "tsr generate && tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.4.0",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@tanstack/react-query": "^5.100.9",
    "@tanstack/react-router": "^1.169.1",
    "@tanstack/react-start": "^1.167.62",
    "@vitejs/plugin-react": "6.0.1",
    "axios": "^1.16.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dompurify": "^3.4.2",
    "jotai": "^2.15.1",
    "lodash": "^4.17.21",
    "lucide-react": "^1.14.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-hook-form": "^7.81.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tanstack/router-cli": "1.77.7",
    "@tanstack/router-plugin": "^1.167.22",
    "@types/lodash": "^4.17.24",
    "@types/node": "25.6.0",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "^6.0.3",
    "vite": "^8.0.11"
  },
  "packageManager": "pnpm@10.33.3"
}
