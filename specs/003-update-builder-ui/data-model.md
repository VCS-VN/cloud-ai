# Data Model: Builder Pages UI Refresh

This feature does not introduce new persisted business data. It refines how existing project and project-detail information is presented and adds UI-only state for search, navigation selection, and view mode.

## Entity: Project

**Purpose**: Represents a website-building project shown in the project management list.

**Fields used by UI**:
- `id`: Stable identifier used to select or open a project.
- `name`: Human-readable project name; must support long names without layout overflow.
- `description` or `initialPrompt`: Summary shown in list and detail areas.
- `status`: Visual state such as draft, generating, ready, or failed.
- `updatedAt`: Recency indicator for sorting and display.

**Validation and display rules**:
- Name and summary must wrap or truncate predictably in cards/list rows.
- Status must have a compact visual label.
- Missing summaries should fall back to a friendly placeholder.

## Entity: Project Navigation Filter

**Purpose**: UI-only grouping selected from the left projects sidebar.

**Fields**:
- `key`: Navigation key such as all projects, recent, starred, created by me, or shared.
- `label`: User-facing label.
- `count`: Optional number of matching projects.

**Validation and display rules**:
- The selected filter must be visually obvious.
- Filters with no count still remain readable and clickable if relevant.

## Entity: Project Search Query

**Purpose**: UI-only text used to narrow visible projects.

**Fields**:
- `query`: User-entered search text.

**Validation and display rules**:
- Search matches project name and prompt/description where available.
- Empty search shows the selected filter's default project list.
- No-result search shows a compact empty state with a clear reset path.

## Entity: Project Detail View Mode

**Purpose**: UI-only state that switches the project output area between code and preview.

**Fields**:
- `mode`: Either `code` or `preview`.

**State transitions**:
- Default mode should be `preview` when visual preview content is available.
- User can switch between code and preview without leaving project detail.
- Switching modes must not clear chat draft or selected project context.

## Entity: Project Chat Panel

**Purpose**: Represents the right-side chat frame for project detail.

**Fields used by UI**:
- `messages`: Existing project messages or activity entries.
- `draft`: UI-only composed message text.
- `sending`: UI state while a message is being sent.
- `error`: UI state when sending or loading fails.

**Validation and display rules**:
- Chat must remain usable in a fixed right panel on desktop and a clean stacked panel on tablet.
- Empty, loading, and error states must be compact.
- Long messages must wrap without horizontal overflow.

## Entity: Generated Structure Item

**Purpose**: Existing generated page/file/folder representation shown in code or structure contexts.

**Fields used by UI**:
- `id`: Stable identifier.
- `name`: Display name.
- `path`: Optional path or hierarchy label.
- `type`: Page, section, file, folder, or equivalent generated structure type.
- `content` or `metadata`: Content shown in code/detail mode.

**Validation and display rules**:
- Long names and paths must truncate or wrap within panel width.
- Empty structure should show a helpful placeholder.
