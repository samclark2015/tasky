# Tasky - Progress Tracker

## Current Status

**Phase:** Phase 6 – Provider Abstraction ✅ COMPLETE  
**Last Updated:** April 3, 2026

## Phase Completion

- [x] Phase 1: Foundation
- [x] Phase 2: Core Task Management
- [x] Phase 3: Calendar & Planner Views
- [x] Phase 4: CalDAV Sync
- [ ] Phase 5: Polish & Notifications
- [x] Phase 6: Provider Abstraction

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

### Auto-sync (completed Apr 2 2026)
- [x] `SyncInterval` type + `syncIntervalMinutes` + `setSyncInterval` added to `useUIStore` (persisted to localStorage via `partialize`)
- [x] `src/hooks/use-auto-sync.ts` — `useAutoSync(adapter)` hook: periodic `setInterval` (reacts to interval setting changes via store subscription) + debounced 30s sync when pending-task count increases (uses `subscribeWithSelector` on `useTaskStore`)
- [x] `AutoSyncMount` inner component in `AppProvider` — mounts only after `ready === true`, calls `useAutoSync(adapter)`
- [x] Settings UI "Sync" section above Accounts — `<select>` for Off / 5 / 15 / 30 / 60 min interval, styled with border/bg-background

### Phase 6: Provider Abstraction ✅ (completed Apr 3 2026)
- [x] 6.1 Rust Provider Metadata System
  - [x] Metadata types in `providers/src/lib.rs` (ProviderFieldDef, ProviderMapFieldDef, ProviderMetadata)
  - [x] `metadata()` method on SyncProvider trait
  - [x] CalDavProvider metadata implementation
  - [x] GitHubProvider metadata implementation
  - [x] `dispatch::list_providers()` + `dispatch::provider_metadata()`
  - [x] Tauri IPC commands (`list_providers`, `get_provider_metadata`)
  - [x] TS types + IPC bridge functions
- [x] 6.2 Unified DB Schema + Repository
  - [x] Migration v10 (create unified tables, migrate data, rename columns, drop old tables)
  - [x] ProviderAccount + ProviderMap TS types (replace CalDavAccount, GitHubAccount, etc.)
  - [x] Task.caldavUid → remoteId, TaskList.caldavUrl → remoteUrl
  - [x] Generic createProviderAccountRepository + createProviderMapRepository
  - [x] Update task/list repos for renamed columns
- [x] 6.3 Unified Sync Store
  - [x] Replace 4 state arrays with `accounts: ProviderAccount[]` + `maps: ProviderMap[]`
  - [x] Consolidate duplicate account/map actions into generic versions
  - [x] Single unified `syncAccount(accountId)` replacing CalDAV + GitHub variants
  - [x] Simplify `syncAll()` and `syncPending()`
  - [x] Auto-sync hook compatible (no changes needed)
- [x] 6.4 Generic Settings UI
  - [x] ProviderAccountRow (replaces CalDavAccountRow + GitHubAccountRow)
  - [x] SourceSettingsInline (replaces RepoSettingsInline)
  - [x] AddAccountForm (replaces AddCalDavAccountForm + AddGitHubAccountForm)
  - [x] Simplified AccountModal
  - [x] Dynamic Lucide icon rendering from metadata
  - [x] Deleted all provider-specific UI components
- [x] 6.5 Cleanup & Verification
  - [x] Remove dead types and stale references (no old CalDavAccount/caldavUid refs remain)
  - [x] Fixed calendar view to use new maps/accounts API
  - [x] cargo build passes clean
  - [x] pnpm typecheck passes clean

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
- Periodic auto-sync: implemented (see Auto-sync notes below)
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

### Phase 6: Structure Refactor (post-Phase 5, completed Apr 2 2026)
- Flattened monorepo: removed `apps/desktop/` nesting, frontend now lives at root
- `src-tauri/` and `providers/` both at root level
- pnpm workspaces eliminated — single root `package.json`
- `@tasky/core` types inlined into `src/types/`; `@tasky/db` inlined into `src/db/`
- Root Cargo workspace members: `["src-tauri", "providers"]`
- All `@core/*`, `@db/*`, `@tasky/core`, `@tasky/db` imports updated to `@/types/*` / `@/db/*`
- `cargo check` and `pnpm typecheck` both pass clean

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

### GitHub Provider (post-Phase 5)
- **Rust**: `packages/providers/src/github/mod.rs` — `GitHubProvider` implementing `SyncProvider`- Uses `reqwest 0.12` with `rustls-tls` (added to `packages/providers/Cargo.toml`)
- Auth: `Authorization: Bearer {token}` header; `X-GitHub-Api-Version: 2022-11-28`
- `test_connection` → `GET /user`; `discover_calendars` → `GET /user/repos?type=all` (paginated)
- `sync` → POST/PATCH issues for pending tasks (push phase uses regular Issues REST API); fetches matching issues via Search API (pull phase)
- `fetch_events` → returns empty (GitHub issues are not calendar events)
- Pull requests filtered out: `is:issue` appended to query + `pull_request.is_none()` belt-and-suspenders check
- **Mapping**: title↔title, body↔description+notes (notes appended after `---` separator), labels↔tags, state(open/closed)↔completed, closed_at↔completedAt
- **No due date sync**: GitHub issues have no native due date field
- **etag**: GitHub `updated_at` ISO timestamp used as etag for change detection
- **remote_id**: GitHub issue number stored as string in `caldavUid` column (generic provider UID reuse)
- **"Delete"**: Issues cannot be deleted via API (without admin); closing them instead
- **Configurable query**: `query` field on `GitHubRepoMap` (default null → falls back to `"assignee:@me is:open"`); passed as `GitHubConfig.query` to Rust; pull phase calls `GET /search/issues?q={user_query} repo:{owner/repo} is:issue`; `#[serde(default)]` means old configs without `query` continue to work
- **read_only mode**: `read_only: bool` field on `GitHubConfig` (`#[serde(default)]`); when true, the push and delete phases are skipped entirely — only the pull (Search API fetch) runs. `readOnly: boolean` on `GitHubRepoMap` (defaults to `false`).
- **query and readOnly are per-repository** (on `github_repo_map`), not per-account. `query: string | null` (null → use default `"assignee:@me is:open"`); `readOnly: boolean` (defaults to `false`). Migration 7 adds these columns to `github_repo_map`; migration 8 drops them from `github_accounts`.
- **DB**: Migration 4 adds `github_accounts` and `github_repo_map` tables. Migration 5 adds `query` to accounts (superseded). Migration 6 adds `read_only` to accounts (superseded). Migration 7 adds `query TEXT` and `read_only INTEGER` to `github_repo_map`. Migration 8 drops `query` and `read_only` from `github_accounts`.
- **TS types**: `GitHubAccount` has no query/readOnly. `GitHubRepoMap` has `query: string | null` and `readOnly: boolean`.
- **DB repos**: `createGitHubAccountRepository` — no query/readOnly fields. `createGitHubRepoMapRepository` — `upsert` and `update` handle query/readOnly.
- **Sync store**: `syncGitHubAccount` builds per-repo config: `query: map.query ?? 'assignee:@me is:open'`, `read_only: map.readOnly`. `updateGitHubRepoMap` action saves per-repo settings.
- **Settings UI**: Account form (step 1) has only display name + token. Step 2 (repos) shows `RepoSettingsInline` under each linked repo with query input and read-only checkbox. `GitHubAccountRow` expanded view shows the same `RepoSettingsInline` per-repo, toggled with a chevron button.

### Auto-sync Implementation Notes (Apr 2 2026)
- `useUIStore` does NOT use `subscribeWithSelector` — only basic `.subscribe(listener)` available; interval change detection done by tracking a `lastInterval` local var in the subscriber
- `useTaskStore` uses `subscribeWithSelector` — selector-based subscription `(state) => countPending(state.tasks)` works there
- Debounce fires only on pending-count *increases* (not decreases after sync) to avoid re-triggering loops
- `triggerSync` reads fresh state at fire time via `getState()` so stale closures are never a problem
- `AutoSyncMount` renders `null`; used purely as a mounting point so hooks run inside `AppContext.Provider` after `ready === true`
- Debounce delay: 30 seconds (constant `DEBOUNCE_DELAY_MS`)

### Phase 6: Provider Abstraction Implementation Notes (Apr 3 2026)
- `ProviderMap.id` is the primary key (a UUID), NOT `listId`. Always use `map.id` for unlink/update operations.
- `ProviderMap.listId` is nullable — `null` for events-only CalDAV calendars (no associated task list)
- Credentials shape: CalDAV → `{ server_url, username, password }`; GitHub → `{ token }` (stored as JSON in `provider_accounts.credentials`)
- Map settings shape: CalDAV → `{ events_only: bool, sync_token: string|null }`; GitHub → `{ query: string|null, read_only: bool }`
- Unified sync config built as `{ ...account.credentials, ...map.settings }` — works for both providers
- `SyncResult` type is defined locally inside `sync.ts` (not exported from `types.ts`)
- Events-only CalDAV maps (listId===null) are skipped during task sync
- Calendar view updated to use `maps` filtered by `providerType === 'caldav'`; `cm.calendarHref` → `cm.sourceId`; credentials extracted via `account.credentials as Record<string,string>`
- `ProviderMetadata.icon` holds Lucide icon name strings ("wifi" for CalDAV, "github" for GitHub); mapped to React components via `ICON_MAP` in settings view
- Settings view is fully metadata-driven: credential form fields and map settings fields are rendered generically from `ProviderMetadata.credentialFields` and `ProviderMetadata.mapFields`
- Migration v10 performs a multi-step SQL migration: creates new tables → copies data → renames columns → drops old tables. Uses `ALTER TABLE` for column renames (SQLite 3.25+ feature)
- `m.settings.events_only` is type `unknown` (from `Record<string,unknown>`); use `!!m.settings.events_only` for JSX boolean contexts
