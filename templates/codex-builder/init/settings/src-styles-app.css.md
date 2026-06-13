---
target: src/styles/app.css
---
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* DESIGN_TOKENS_START */
  :root {
    --background: #ffffff; --foreground: #111827; --card: #ffffff; --card-foreground: #111827; --popover: #ffffff; --popover-foreground: #111827; --primary: #111827; --primary-foreground: #ffffff; --secondary: #f3f4f6; --secondary-foreground: #111827; --muted: #f3f4f6; --muted-foreground: #6b7280; --accent: #f3f4f6; --accent-foreground: #111827; --destructive: #dc2626; --destructive-foreground: #ffffff; --border: #e5e7eb; --input: #e5e7eb; --ring: #111827; --highlight: #fde68a; --highlight-foreground: #1f1300; --success: #16a34a; --warning: #d97706; --error: #dc2626; --deep: #111827; --deep-foreground: #ffffff; --radius: 0.75rem;
  }
  .dark {
    --background: #0b0f19; --foreground: #f3f4f6; --card: #151b27; --card-foreground: #f3f4f6; --popover: #151b27; --popover-foreground: #f3f4f6; --primary: #f3f4f6; --primary-foreground: #111827; --secondary: #1f2837; --secondary-foreground: #f3f4f6; --muted: #1f2837; --muted-foreground: #9ca3af; --accent: #1f2837; --accent-foreground: #f3f4f6; --destructive: #f87171; --destructive-foreground: #1b0a0a; --border: #2a3340; --input: #2a3340; --ring: #cbd5e1; --highlight: #f4b400; --highlight-foreground: #1f1300; --success: #22c55e; --warning: #f59e0b; --error: #f87171; --deep: #0b0f19; --deep-foreground: #f3f4f6; --radius: 0.75rem;
  }
  /* DESIGN_TOKENS_END */

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
}
