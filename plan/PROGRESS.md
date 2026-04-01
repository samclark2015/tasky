# Tasky - Progress Tracker

## Current Status

**Phase:** Phase 3 Complete  
**Last Updated:** April 1, 2026

## Phase Completion

- [x] Phase 1: Foundation
- [x] Phase 2: Core Task Management
- [x] Phase 3: Calendar & Planner Views
- [ ] Phase 4: CalDAV Sync
- [ ] Phase 5: Polish & Notifications

## Detailed Progress

### Phase 1: Foundation ✅
- [x] Monorepo scaffolding (pnpm workspaces)
- [x] Tauri 2.x project setup
- [x] React + TypeScript + Vite configuration
- [x] SQLite integration (tauri-plugin-sql)
- [x] Zustand store setup (tasks, lists, ui)
- [x] shadcn/ui + Tailwind CSS installed and configured
- [x] App shell (three-panel layout)
- [x] Basic navigation (Today, Inbox, Calendar, Planner views)
- [x] Light/dark/system theme switching

### Phase 2: Core Task Management ✅
- [x] Task creation (quick-add inline + full modal with all fields)
- [x] Task editing (inline in details panel + full modal)
- [x] Task deletion with subtask cascade
- [x] Toggle task completion
- [x] Unlimited subtask nesting (recursive in-memory + SQL ON DELETE CASCADE)
- [x] List management (create, rename, color picker, delete)
- [x] Today view (today's tasks + overdue grouping + completed section)
- [x] Inbox view (unassigned tasks + quick-add)
- [x] List view (per-list task display)
- [x] Full details panel (inline editing: title, description, due date, priority, list, tags, notes, time estimate, subtasks)
- [x] Search view (full-text search across title, description, notes, tags)
- [x] Keyboard shortcuts (n=new task, 1-4=nav, Cmd+F=search, Escape=deselect)

### Phase 3: Calendar & Planner Views ✅
- [x] FullCalendar integration (@fullcalendar/react v6 + daygrid + timegrid + interaction plugins)
- [x] Calendar view (day/week/month switcher, today button, navigation)
- [x] Tasks displayed as events, color-coded by list color or priority
- [x] Click task event to open details panel
- [x] Click date/slot to create new task with that date pre-filled
- [x] Drag-to-schedule (drop event updates task due date)
- [x] Drag-to-resize (resize event updates time estimate)
- [x] Now indicator on time grid
- [x] Planner view (14-day vertical agenda, collapsible day groups)
- [x] Daily time estimate totals with over-schedule warning (>8h)
- [x] Unscheduled tasks section with quick-add
- [x] Recurrence rule editor component (daily/weekly/monthly/yearly, interval, day-of-week picker, end conditions)
- [x] Recurrence integrated into TaskModal (create/edit) and DetailsPanel (inline)

### Phase 4: CalDAV Sync
- [ ] CalDAV client library
- [ ] Server connection UI
- [ ] Calendar discovery
- [ ] Task sync (local → remote)
- [ ] Task sync (remote → local)
- [ ] Conflict resolution
- [ ] Sync status indicators

### Phase 5: Polish & Notifications
- [ ] System notifications
- [ ] Notification preferences
- [ ] Error handling
- [ ] Unit tests
- [ ] macOS build
- [ ] Windows build
- [ ] Linux build

## Blockers

None currently.

## Notes

### Phase 1 Implementation Notes
- Using `npx pnpm` as pnpm is not in PATH directly (available via npx)
- Rust/Cargo toolchain: nightly 1.92.0
- Icons are placeholder solid-color PNGs (indigo #6366f1); replace before shipping
- tauri-plugin-sql configured to preload sqlite:tasky.db
- Database adapter pattern keeps repository layer testable without Tauri
- Zustand ui store persists sidebar state and theme to localStorage

### Phase 2 Implementation Notes
- TaskItem is recursive; renders subtasks at any depth with 20px indent per level
- QuickAdd inline bar at bottom of each view for fast entry
- TaskModal handles both create and edit via optional `task` prop
- ListModal includes color picker (12 presets) and delete with confirmation
- Details panel has inline editing for all fields; changes save immediately on blur/change
- Search is in-memory (no DB round trip) since all tasks are loaded at startup
- Cascade delete: SQLite ON DELETE CASCADE for DB + in-memory recursive removal
- Keyboard shortcuts: n=new task, 1-4=navigate, Cmd+F=search, Escape=deselect task

### Phase 3 Implementation Notes
- FullCalendar v6 injects CSS via JS bundle; no separate CSS imports needed
- FullCalendar themed via CSS custom properties in `.fc-wrapper` container class
- `DateClickArg` is exported from `@fullcalendar/interaction`, not `@fullcalendar/core`
- Calendar events color-coded: list color takes priority over priority color
- Tasks without a time component on their dueDate render as all-day events
- Planner shows 14 days ahead; past dates not shown (use Today/Calendar views)
- Over-schedule warning threshold: 8h of estimated time in a single day
- RecurrenceEditor is a standalone component used in both TaskModal and DetailsPanel
- Recurrence stored as `RecurrenceRule` on the Task; instance generation deferred to Phase 4/5
