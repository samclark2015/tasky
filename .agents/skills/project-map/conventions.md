# Conventions & Patterns

> Part of the `project-map` skill. See `SKILL.md` for overview and directory tree.

## State Management

- **Zustand for all state** -- no Redux, no React Context for data (only for DB adapter and theme)
- **Stores are independent** -- they never import each other
- **DatabaseAdapter passed as parameter** -- all store actions that touch DB receive `adapter` from `useApp()`
- **useAutoSync is the sole cross-store orchestrator** -- it subscribes to multiple stores and coordinates sync

## Component Patterns

- **Inline editing** -- `DetailsPanel` uses an `InlineField` component (click display value -> toggle to input -> commit on blur/Enter, cancel on Escape)
- **Portal context menus** -- `TaskContextMenu` renders via `createPortal` to `document.body`, entirely custom (not Radix)
- **Modals via Radix Dialog** -- always `open={true}`, parent controls mounting/unmounting
- **Recursive TaskItem** -- subtask trees rendered by `TaskItem` rendering its own children with increasing depth
- **Renderless hooks** -- `AutoSyncMount` is a component that renders null, solely to call `useAutoSync`

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `task-item.tsx`, `use-auto-sync.ts` |
| Components | PascalCase | `TaskItem`, `QuickAdd` |
| Stores | `use<Name>Store` | `useTaskStore`, `useUIStore` |
| Hooks | `use<Name>` | `useAutoSync`, `useApp`, `useTheme` |
| Types | PascalCase | `Task`, `NewTask`, `RecurrenceRule` |
| Barrel exports | `index.ts` | `src/stores/index.ts`, `src/types/index.ts` |

## Date Handling

- **Use `localDateFromString()` for YYYY-MM-DD strings** -- `new Date('YYYY-MM-DD')` parses as UTC midnight, which shifts the date in non-UTC timezones
- ISO datetime strings (`2024-01-01T12:00:00.000Z`) use `new Date()` directly
- `dueDate` on tasks can be either date-only or full datetime
- `formatDate()` uses browser locale via `toLocaleDateString()`
- `parseDate()` (private in utils.ts) routes plain YYYY-MM-DD through `localDateFromString`, ISO datetime through `new Date()`

## IDs

- All frontend IDs are UUIDs generated via `crypto.randomUUID()` (`generateId()` in utils.ts)
- Rust-side uses `uuid::Uuid::new_v4()` for CalDAV UIDs

## Sync

- `syncStatus` field on Task: `pending` -> `synced` on successful push/pull; `conflict` when remote changes arrive for a locally-pending task
- `caldavUid` is reused for GitHub issue numbers (pragmatic field reuse rather than adding columns)
- `etag` stores CalDAV ETag or GitHub `updated_at`
- Auto-sync has two triggers: periodic (configurable interval) and debounced (30s after pending tasks appear)
- CalDAV conditional PUT uses `If-Match` for updates, `If-None-Match: *` for creates

---

## Styling & Design Tokens

### CSS Variable System (src/index.css)

Follows shadcn/ui convention: HSL values as raw channels (e.g., `222.2 84% 4.9%`), consumed as `hsl(var(--token))` enabling Tailwind opacity modifiers.

**Token categories:** `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, plus sidebar-specific variants (`--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-accent`, `--sidebar-accent-foreground`).

### Dark Mode

`.dark` class on `<html>`, toggled by ThemeProvider. Three-way: light/dark/system (system watches `prefers-color-scheme` media query).

### Tailwind Config (tailwind.config.js)

Extends default theme with CSS variable references. Uses `class` strategy for dark mode. No custom plugins.

### FullCalendar Theming

FullCalendar CSS variables overridden inside `.fc-wrapper` class in `index.css`, mapping to the app's design tokens.

### Base Styles (index.css)

- Disables user-select globally (re-enables for inputs/textareas/contenteditable)
- Sets background/foreground colors
- Disables overscroll-behavior
- Utility classes: `.no-select`, `.drag-region` (Tauri window dragging), `.no-drag`

---

## Gotchas

| Issue | Solution |
|---|---|
| `new Date('YYYY-MM-DD')` parses as UTC midnight | Use `localDateFromString()` from `src/lib/utils.ts` |
| `caldavUid` reused for GitHub issue numbers | Check context -- CalDAV uses UUID strings, GitHub uses numeric strings |
| `etag` stores GitHub `updated_at` | Not an actual HTTP ETag for GitHub |
| `components/ui/` directory is empty | All UI built inline with Tailwind + Radix primitives |
| CalDAV iCal `Content-Type` | Must be `text/calendar` without charset |
| `PutResource::new(href)` | Data is passed at mode selection (`.create(data, ct)` / `.update(data, ct, etag)`), not constructor |
| `Delete<WithEtag>` vs `Delete<Force>` | Distinct Rust types -- use separate `client.request()` calls |
| CATEGORIES in icalendar crate | Multi-property -- `property_value()` won't find it; use `multi_properties().get("CATEGORIES")` |
| CalDAV DUE field | Can be date-only ("YYYYMMDD") or datetime with timezone -- handle both in `ical.rs` |
| GitHub "delete" | Actually closes the issue (PATCH state=closed) -- no true delete API |
| GitHub search pagination | Max 1000 results across all pages |
