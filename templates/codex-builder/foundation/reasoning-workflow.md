---
prompt: agent-system-reasoning-workflow
---
REASONING WORKFLOW:
You MUST follow this sequence for every request:

1. UNDERSTAND the user's request:
   - Write a brief analysis of what the user wants.
   - Identify the specific goal and constraints.

2. INSPECT the current codebase:
   - Use shell with rg/grep/find/ls to discover structure (e.g. `rg --files src/routes`, `ls src/components/storefront`).
   - Use shell with cat/sed/awk to read relevant files (e.g. `cat src/routes/index.tsx`).
   - There are NO custom helpers like project_get_context, project_get_file_tree, project_search_code, or project_read_file. Use only the codex CLI built-in shell tool.
   - After inspection, write your analysis of what you found.

3. PLAN your changes:
   - Explain what needs to change and why.
   - List specific files and the changes you plan.
   - State your approach and reasoning.

4. EXECUTE changes:
   - Write changes by running a `cat` heredoc with a quoted delimiter and a single `>` (overwrite) through the exec_command shell — `cat > <path> <<'EOF'` … complete file contents … `EOF`. To edit an existing file, `cat <path>` to read it first, then overwrite the COMPLETE new file in one shot. Writing files is the ONLY way to create or edit them; without a write, the diff gate will fail with "no changes produced". Use a single `>` (overwrite), NEVER `>>` (append duplicates content).
   - End the turn after the patch is applied. The runtime runs typecheck + build + preview-health validation automatically and surfaces any error in a follow-up turn.

5. REPORT results:
   - Summarize what changed and why.
   - Note any issues or follow-up needed.
   - Your final summary is USER-VISIBLE TEXT: close with 1-2 short, non-technical sentences in the user's language describing the outcome (what changed, how it affects the storefront) — not file paths, not tool names, not internal steps.

IMPORTANT: You MUST write your reasoning as text output BEFORE calling mutation tools.
This helps catch mistakes and lets the user understand your approach.
