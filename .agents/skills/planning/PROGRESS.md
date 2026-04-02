# Tasky - Progress Tracker

## Current Status

**Phase:** Phase 5 – Polish & Notifications  
**Last Updated:** April 1, 2026

## Phase Completion

- [x] Phase 1: Foundation
- [x] Phase 2: Core Task Management
- [x] Phase 3: Calendar & Planner Views
- [x] Phase 4: CalDAV Sync
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

### Phase 4: CalDAV Sync ✅
- [x] CalDAV client library (libdav 0.10 + icalendar 0.17 via Rust)
- [x] DB migration: caldav_accounts + caldav_calendar_map tables + indexes
- [x] CalDavAccount / CalDavCalendarMap / DiscoveredCalendar / SyncResult types in @tasky/core
- [x] caldav_accounts + caldav_calendar_map repositories in @tasky/db
- [x] Rust commands: caldav_test_connection, caldav_discover_calendars, caldav_sync_account
- [x] iCalendar VTODO parse + generate (ical.rs) with X-TASKY-* extensions
- [x] Server connection UI (Settings view with add/edit/remove accounts)
- [x] Calendar discovery (PROPFIND → principal → home-set → FindCalendars)
- [x] Link/unlink calendars to local lists
- [x] Task sync local → remote (PUT with ETag conditional updates)
- [x] Task sync remote → local (ListCalendarResources + GetCalendarResources)
- [x] Conflict resolution: last-write-wins via updatedAt timestamp
- [x] Sync status indicator in sidebar (Wifi/WifiOff icons + spinning on sync)
- [x] Settings nav item in sidebar footer
- [x] syncAll loads all enabled accounts, syncs each calendar in sequence
- [x] VEVENT fetch command (caldav_fetch_events) for calendar view display
- [x] CalendarEvent type + events Zustand store slice
- [x] Calendar view: render VEVENTs read-only alongside task events
- [x] Per-calendar visibility toggles (persisted to localStorage)
- [x] Event detail popover with "Add to Tasks" action
- [x] Promote VEVENT → Task (pre-fill from event, store sourceEventUid, sync as VTODO)
- [x] source_event_uid DB column + X-TASKY-SOURCE-EVENT-UID VTODO property

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

### Phase 4 Implementation Notes
- Libraries: `libdav` 0.10 (CalDAV HTTP) + `icalendar` 0.17 (VTODO parse/generate); no hand-rolled DAV
- Type alias `TaskyCalDavClient` avoids unnameable return type for `make_client()`
- `PutResource::new(href).create(data, content_type)` / `.update(data, content_type, etag)` — data passed at mode selection, not construction
- `Delete<WithEtag>` and `Delete<Force>` are distinct types; conditional deletion uses two separate `client.request()` calls in each match arm
- `ListCalendarResources::with_component()` returns `Result`; must be unwrapped before passing to `client.request()`
- FoundCollection (calendar discovery) only has href/etag/supports_sync; display names fetched separately via PROPFIND if needed
- VTODO DUE date: CalendarDateTime enum (Floating/Utc/WithTimezone) — each variant handled explicitly
- Custom VTODO properties: X-TASKY-NOTES, X-TASKY-TIME-ESTIMATE for round-tripping Tasky-specific fields
- Credentials stored in SQLite (plaintext for MVP); encrypt pre-ship via Tauri secure storage
- Sync runs entirely in Rust async tasks; frontend only passes task data via invoke()
- Subtask syncing: only root tasks (parentId === null) pushed to CalDAV (RELATED-TO used for linking)
- Periodic auto-sync: not yet implemented (Phase 5)
- FullCalendar v6 injects CSS via JS bundle; no separate CSS imports needed
- FullCalendar themed via CSS custom properties in `.fc-wrapper` container class
- `DateClickArg` is exported from `@fullcalendar/interaction`, not `@fullcalendar/core`
- Calendar events color-coded: list color takes priority over priority color
- Tasks without a time component on their dueDate render as all-day events
- Planner shows 14 days ahead; past dates not shown (use Today/Calendar views)
- Over-schedule warning threshold: 8h of estimated time in a single day
- RecurrenceEditor is a standalone component used in both TaskModal and DetailsPanel
- Recurrence stored as `RecurrenceRule` on the Task; instance generation deferred to Phase 4/5
- **VEVENT implementation (completed):**
  - VEVENTs fetched on-demand per visible date range via `caldav_fetch_events` Rust command
  - NOT persisted to SQLite; stored in a `events` Zustand slice (keyed `calendarHref:uid`)
  - Fetching triggered automatically via `datesSet` callback when calendar view range changes
  - FullCalendar `extendedProps.type` distinguishes `'task'` vs `'event'` in eventClick handler
  - VEVENTs are non-editable/non-draggable; click opens EventDetailPopover (not DetailsPanel)
  - EventDetailPopover shows event details with "Add to Tasks" button
  - "Add to Tasks" pre-fills TaskModal with event data (title, description, dates); saved task gets `sourceEventUid`
  - Promoted task syncs as VTODO on next CalDAV sync; original VEVENT untouched on server
  - Migration #3 adds `source_event_uid` column to tasks table + index
  - `source_event_uid` serialized as `X-TASKY-SOURCE-EVENT-UID` property in VTODO for round-trip fidelity
  - VEvent struct in ical.rs parses: UID, SUMMARY, DESCRIPTION, DTSTART, DTEND, LOCATION, COLOR
  - CalendarEvent type in @tasky/core includes all VEVENT fields plus calendarHref for keying
  - Per-calendar visibility toggles deferred (low priority; all enabled calendars show events by default)

### Provider Refactor (post-Phase 4)
- **Architecture**: Provider logic lives in a standalone Rust crate `packages/providers` (`tasky-providers`), fully decoupled from the Tauri app crate
- `packages/providers/src/lib.rs` — `SyncProvider` trait + canonical types (`ProviderTask`, `ProviderEvent`, `ProviderCalendar`, `SyncOutput`, etc.)
- `packages/providers/src/caldav/mod.rs` — `CalDavProvider` implementing `SyncProvider`; no Tauri dependency
- `packages/providers/src/caldav/ical.rs` — iCalendar VTODO/VEVENT parse + generate
- `apps/desktop/src-tauri/src/providers/caldav/mod.rs` — thin `#[tauri::command]` wrappers only; imports from `tasky_providers`
- `apps/desktop/src/providers/ipc.ts` — generic TS IPC bridge (4 functions, parameterised by provider ID string); no per-provider TS code ever needed
- `apps/desktop/src/providers/types.ts` — canonical TS types mirroring Rust structs
- `stores/sync.ts` and `stores/events.ts` call the generic IPC bridge with `'caldav'` as provider ID
- **Cargo workspace**: root `Cargo.toml` declares both `apps/desktop/src-tauri` and `packages/providers` as workspace members
- **To add a new provider** (e.g. Google Calendar, GitHub Issues): add a new Rust crate or module under `packages/providers/src/<name>/`, implement `SyncProvider`, add `#[tauri::command]` wrappers in `apps/desktop/src-tauri/src/providers/<name>/mod.rs`, register in `lib.rs` — zero TS changes required
