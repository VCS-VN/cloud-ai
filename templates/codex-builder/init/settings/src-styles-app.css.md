---
target: src/styles/app.css
---
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-paper: 250 248 244;
  --color-chalk: 255 255 255;
  --color-surface: 244 241 235;
  --color-hairline: 224 218 208;
  --color-ink: 24 24 27;
  --color-deep: 9 9 11;
  --color-muted: 82 82 91;
  --color-subtle: 113 113 122;
  --color-accent: 28 97 231;
  --color-accent-foreground: 255 255 255;
  --color-success: 22 163 74;
  --color-warning: 217 119 6;
  --color-danger: 220 38 38;

  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --radius-card: 1rem;
  --radius-button: 0.75rem;
  --radius-input: 0.75rem;
  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.05), 0 16px 40px rgb(15 23 42 / 0.08);
  --shadow-card-hover: 0 1px 2px rgb(15 23 42 / 0.06), 0 24px 60px rgb(15 23 42 / 0.12);
}

html {
  background: rgb(var(--color-paper));
  color: rgb(var(--color-ink));
  font-family: var(--font-sans);
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: rgb(var(--color-paper));
}

* {
  box-sizing: border-box;
}
