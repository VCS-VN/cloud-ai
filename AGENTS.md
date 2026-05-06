<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/005-chatgpt-project-setup/plan.md`

UI updates must feel smooth and polished. For future component/page changes,
use subtle transitions for hover, focus, loading, modal, and state changes
where appropriate, while preserving accessibility and existing theme tokens.

UI icons must use semantic theme tokens. Prefer inheriting the parent
foreground only when that parent already has a safe foreground; otherwise
use app icon tokens such as `--app-icon`, `--app-icon-muted`,
`--app-icon-subtle`, `--app-icon-selected`, or
`--app-icon-on-color-block`. Do not hardcode icon colors with raw hex,
`text-white`, `text-black`, or surface-specific colors unless it is an
official brand asset such as the Google logo.
<!-- SPECKIT END -->
