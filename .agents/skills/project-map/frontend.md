# Frontend Components & Views

> Part of the `project-map` skill. See `SKILL.md` for overview and directory tree.

## Entry Point (src/main.tsx)

Mounts React at `#root`. Provider nesting: `StrictMode > ThemeProvider > AppProvider > App`.

## App.tsx

Root component. Contains:
- `ViewRouter` -- switch on `ViewType` to render view components
- Keyboard shortcuts (Cmd+F, n, Escape, 1-4)
- Theme sync to Tauri backend via `invoke('sync_theme', { theme })`
- Listens for `set-theme` events from backend

## App Provider (src/components/app-provider.tsx)

**Exports:** `AppProvider` (component), `useApp()` (hook returning `{ adapter, ready, error }`)

Initialization sequence:
1. `getDatabase()` + `createAdapter()` -> SQLite connection
2. `runMigrations()` -> apply schema
3. Hydrate stores in parallel: `loadTasks`, `loadLists`, `loadAccounts`
4. Show loading spinner until ready, error message on failure
5. Mount `AutoSyncMount` (renderless component calling `useAutoSync`)

## Theme Provider (src/components/theme-provider.tsx)

**Exports:** `ThemeProvider` (component), `useTheme()` (hook returning `{ theme, setTheme }`)

Reads theme from `useUIStore`, applies `dark` CSS class on `document.documentElement`. Handles `system` theme via `prefers-color-scheme` media query listener.

---

## Layout Components (src/components/layout/)

### AppShell (app-shell.tsx)

3-column flexbox: sidebar | main | details panel.
- Sidebar width: `w-60` expanded, `w-14` collapsed (via `sidebarOpen` state)
- Main area: `data-tauri-drag-region` div (h-8) for custom title bar, then `children`
- Details panel: `w-80`, conditional on `detailsPanelOpen`

### Sidebar (sidebar.tsx)

- 5 nav items: Today, Inbox, Search, Calendar, Planner (with lucide icons)
- User-created task lists with colored dots
- Footer: Sync button (shows status), Settings button, New List button
- Collapsed mode: icons only with custom positioned tooltips
- Opens `ListModal` for creating/editing lists

### DetailsPanel (details-panel.tsx)

Full task detail editor. Supports inline editing for all fields:
- Title, description, due date (with time + all-day toggle), priority (pill buttons), list (Radix dropdown), time estimate (hh:mm), tags (`TagInput`), recurrence (`RecurrenceEditor`), notes
- Subtask management: `TaskItem` list + `QuickAdd` for new subtasks
- Metadata display (created/completed timestamps)
- Navigation to parent task, Edit (TaskModal), Delete, Close buttons

**Internal component:** `InlineField` -- click-to-edit pattern (display -> input on click, commit on blur/Enter, cancel on Escape). Supports text/date/textarea/number types.

### ViewHeader (view-header.tsx)

Simple presentational component: renders children (title) on left, optional `actions` prop on right, with bottom border.

---

## Modal Components (src/components/modals/)

### TaskModal (task-modal.tsx)

Radix Dialog for creating/editing tasks.
- **Create mode:** pass `defaults` prop (pre-fills fields like dueDate, parentId)
- **Edit mode:** pass `task` prop
- Fields: title, description, due date + time + all-day, time estimate, priority, list, tags, recurrence, notes
- `Cmd/Ctrl+Enter` to save, auto-focuses title

### ListModal (list-modal.tsx)

Radix Dialog for creating/editing/deleting lists.
- 12 preset color swatches (`PRESET_COLORS` constant)
- Delete with inline 2-step confirmation ("Delete all tasks too?")
- On delete: also deletes all tasks in list, navigates to inbox if deleted list was active

---

## Task Components (src/components/task/)

### TaskItem (task-item.tsx)

Recursive task row component. Renders:
- Expand/collapse chevron (for subtasks)
- Completion toggle circle
- Optional list color dot
- Title (strikethrough when completed)
- Subtask progress count
- Due date (red if overdue)
- Priority dot
- Hover-visible "add subtask" button
- Right-click opens `TaskContextMenu`
- Click selects task (opens details panel)

**Recursive:** renders child `TaskItem` components with increasing `depth` (indentation via inline `style`).

### TaskContextMenu (task-context-menu.tsx)

Custom right-click context menu (NOT Radix). Rendered via `createPortal` to `document.body`.
- Submenus: Priority (high/medium/low), Tags (current + suggestions + create), Move to list
- Actions: Unschedule (remove due date), Delete (inline confirmation)
- Uses `useAdjustedPos` hook to stay within viewport bounds
- Closes on outside click or Escape

### QuickAdd (quick-add.tsx)

Minimal inline input for rapid task creation. Shows Plus icon + input. Submits on Enter, clears on Escape. Accepts `onAdd` callback.

### TagInput (tag-input.tsx)

Tag pills with autocomplete dropdown.
- Suggestions from all tags across all tasks in store
- "Create" option for new tags
- Keyboard: ArrowUp/Down navigate, Enter/Tab select, comma adds, Backspace removes last
- Outside-click detection via `mousedown` listener

### RecurrenceEditor (recurrence-editor.tsx)

Toggle-based recurrence form. When enabled:
- Frequency: daily/weekly/monthly/yearly (pill buttons)
- Interval: number input
- Day-of-week: circular buttons (weekly only)
- End condition: Never / After N times / On a date
- Outputs `RecurrenceRule | null`

---

## Views (src/views/)

### TodayView (today/index.tsx)

- Groups tasks: Overdue (red styling) | Due today | Completed today
- QuickAdd creates with `dueDate: new Date().toISOString()`
- Shows date formatted as "Wednesday, April 2"

### InboxView (inbox/index.tsx)

- Tasks with no `listId`, not completed, root only (no parentId)
- Separate "Completed" section
- QuickAdd creates with `{ title }` only

### ListView (list/index.tsx)

- Tasks for `currentListId` from UI store
- Active + completed sections
- List color dot in header
- "..." button opens ListModal for editing
- Guard: "List not found" when no match

### CalendarView (calendar/index.tsx) -- 373 lines

- FullCalendar (dayGridMonth, timeGridWeek [initial], timeGridDay)
- Tasks as events, color-coded by list color or priority (high=red, medium=yellow, low=gray)
- VEVENT events from CalDAV, filterable by calendar visibility toggles
- Drag-and-drop: updates `dueDate`; resize updates `dueDate` + `timeEstimate`
- Date/range selection creates new tasks with pre-filled date/time
- Right-click task event: `TaskContextMenu`
- Click VEVENT: `EventDetailPopover` with "Add to Tasks" action
- Calendar toggle dropdown to show/hide individual CalDAV calendars
- Slot range: 06:00-23:00, now indicator enabled

**Sub-component:** `EventDetailPopover` (calendar/event-detail-popover.tsx) -- positioned at click coordinates, shows event details, "Add to Tasks" button.

### PlannerView (planner/index.tsx) -- 209 lines

- 14-day rolling planner (`DAYS_AHEAD = 14`)
- Collapsible `DayBlock` components grouped by due date
- Each day: label (Today/Tomorrow/weekday/date), task count, time estimate total
- Over-scheduling warning: total > 480 min (8h) shown in destructive styling
- Separate collapsible "Unscheduled" section for tasks without dueDate

### SearchView (search/index.tsx)

- Auto-focuses search input on mount
- Case-insensitive search across task `title`, `description`, `notes`, and `tags`
- Results as `TaskItem` components with list color

### SettingsView (settings/index.tsx) -- 1042 lines

Largest view. Internal components:
- `CalDavAccountRow` -- expandable, shows linked calendars
- `GitHubAccountRow` -- expandable, shows linked repos
- `RepoSettingsInline` -- per-repo query + read-only settings
- `AddAccountModal` / `EditAccountModal` -- Radix Dialog wrappers
- `AddCalDavAccountForm` -- multi-step: credentials -> test connection -> discover calendars -> link/unlink (tasks or events-only)
- `AddGitHubAccountForm` -- multi-step: credentials (PAT) -> connect -> discover repos -> link/unlink

Features: sync status banner, auto-sync interval dropdown (Off/5/15/30/60 min), "Sync Now" button, account CRUD for both provider types.

---

## Hooks (src/hooks/)

### useAutoSync (use-auto-sync.ts)

Two automatic sync triggers:

1. **Periodic sync** -- `setInterval` based on `syncIntervalMinutes`. Calls `syncAll()`. Re-subscribes when setting changes.
2. **Debounced pending sync** -- subscribes to `useTaskStore.tasks` via `subscribeWithSelector`. Watches for new pending list IDs (Set comparison). 30s debounce (`DEBOUNCE_DELAY_MS`). Calls `syncPending()` with only affected list IDs.

Both are no-ops when `isSyncing` is true. Uses stable `adapterRef` to avoid re-registering effects. On mount, schedules initial sync if pending tasks exist.

Mounted via `AutoSyncMount` renderless component in `AppProvider`.

---

## UI Primitives (src/components/ui/)

**Currently empty.** All UI is built directly with Tailwind utility classes + Radix primitives (Dialog, DropdownMenu). No shared Button/Input/Card components exist.
