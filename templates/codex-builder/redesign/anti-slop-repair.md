Anti-slop design checks failed on the files you just changed. Fix ONLY these violations with minimal patches; do not redesign or touch unrelated code.

DESIGN.md is the source of truth. Use only declared palette roles (primary/accent/highlight/deep + surface/foreground/semantic) via Tailwind semantic utilities — never raw color utilities like bg-purple-500 or text-rose-400, and never default AI-purple/violet gradients.

Violations to fix:
{{violations}}

1. Re-read DESIGN.md tokens via shell (e.g. `cat DESIGN.md`).
2. Inspect each listed file via shell (`cat <path>`) before patching.
3. Replace off-palette colors with the matching DESIGN.md role utility via apply_patch.
4. End the turn after patches; the runtime runs validation automatically and reports any remaining errors in a follow-up turn.
