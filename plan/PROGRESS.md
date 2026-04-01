# Tasky - Progress Tracker

## Current Status

**Phase:** Phase 2 Complete  
**Last Updated:** March 31, 2026

## Phase Completion

- [x] Phase 1: Foundation
- [x] Phase 2: Core Task Management
- [ ] Phase 3: Calendar & Planner Views
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

### Phase 3: Calendar & Planner Views
- [ ] FullCalendar integration
- [ ] Calendar view (day/week/month)
- [ ] Planner view
- [ ] Drag-to-schedule
- [ ] Time estimation UI
- [ ] Recurrence rule editor
- [ ] Recurrence logic

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
