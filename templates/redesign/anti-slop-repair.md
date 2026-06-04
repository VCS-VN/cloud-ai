Anti-slop design checks failed on the files you just changed. Fix ONLY these violations with minimal patches; do not redesign or touch unrelated code.

DESIGN.md is the source of truth. Use only declared palette roles (primary/accent/highlight/deep + surface/foreground/semantic) via Tailwind semantic utilities — never raw color utilities like bg-purple-500 or text-rose-400, and never default AI-purple/violet gradients.

Violations to fix:
{{violations}}

1. Call project_read_design_rules to reload DESIGN.md tokens.
2. Inspect each listed file with project_read_file before patching.
3. Replace off-palette colors with the matching DESIGN.md role utility.
4. Run project_run_validation after mutations.
