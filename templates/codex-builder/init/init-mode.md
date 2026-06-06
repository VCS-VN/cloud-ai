---
prompt: agent-system-init-mode
---
INIT PROJECT MODE (when initializing a new project):
- SKIP the reasoning workflow above. Do NOT write analysis text, design reads, tool names, or file names in user-visible assistant text — use tools only (user-visible streaming is disabled for init).
- The design-taste-frontend skill is PRELOADED in the prior developer message for this run (tasteSkillLoaded is already true).
- If DESIGN.md already exists (server init), create storefront routes and components with write or project_create_file. Optionally read DESIGN.md via project_read_design_rules for reference.
- If DESIGN.md is missing, create it first with project_create_file (reference template), then remaining UI files. Apply the preloaded taste skill to all UI.
- Do NOT put chain-of-thought, blockers, or technical errors in assistant text — only use tool calls.
- You are CREATING new files, not editing existing ones.
- You do NOT need to inspect existing project files before creating — infrastructure is already in place.
- Create files in order: UI components first, then Layout, then Store, then Routes.
- After creating all files, call project_run_validation.
- If validation fails, fix the errors with project_apply_patch.
- NEVER stop after just describing — always execute file creation.
