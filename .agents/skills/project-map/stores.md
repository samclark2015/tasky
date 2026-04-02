# Stores

> Part of the `project-map` skill. See `SKILL.md` for overview and directory tree.

All stores use Zustand. Imported via barrel `@/stores` (`src/stores/index.ts`).

## Rules

- Stores **never import other stores** -- they are kept independent
- The `useAutoSync` hook is the sole cross-store orchestrator
- All store actions that touch the DB require a `DatabaseAdapter` parameter (obtained from `useApp()`)

---

## useTaskStore (src/stores/tasks.ts)

**State:**

```typescript
tasks: Map<string, Task>   // keyed by task ID
loading: boolean
error: string | null
```

**Actions:**

| Action | Signature | Key Logic |
|---|---|---|
| `loadTasks` | `(adapter) => Promise<void>` | Fetches all tasks via repo, builds Map |
| `createTask` | `(adapter, partial: Partial<Task> & { title }) => Promise<Task>` | Generates UUID, defaults priority=medium, completed=false, syncStatus=pending |
| `updateTask` | `(adapter, id, updates: Partial<Task>) => Promise<void>` | Auto-sets `syncStatus: 'pending'` for CalDAV-linked tasks (has `caldavUid`) unless caller explicitly sets syncStatus |
| `deleteTask` | `(adapter, id) => Promise<void>` | Recursively collects all descendant IDs, deletes via repo (SQL ON DELETE CASCADE), removes from Map |
| `toggleComplete` | `(adapter, id) => Promise<void>` | Toggles `completed`, sets/clears `completedAt` timestamp |
| `getTasksByList` | `(listId) => Task[]` | Returns root tasks (parentId===null) for a given list |
| `getTodayTasks` | `() => Task[]` | Returns incomplete tasks whose `dueDate` starts with today's YYYY-MM-DD |
| `getInboxTasks` | `() => Task[]` | Returns incomplete root tasks with no list assignment |
| `getSubtasks` | `(parentId) => Task[]` | Returns tasks whose parentId matches |

Uses `subscribeWithSelector` middleware for granular subscriptions (used by the auto-sync hook to watch for pending tasks).

---

## useListStore (src/stores/lists.ts)

**State:**

```typescript
lists: TaskList[]    // flat array
loading: boolean
error: string | null
```

**Actions:**

| Action | Signature | Key Logic |
|---|---|---|
| `loadLists` | `(adapter) => Promise<void>` | Fetches all lists ordered by name |
| `createList` | `(adapter, name, color?) => Promise<TaskList>` | Generates UUID, sets `caldavUrl: null` |
| `updateList` | `(adapter, id, updates: Partial<TaskList>) => Promise<void>` | Partial update, bumps `updatedAt` |
| `deleteList` | `(adapter, id) => Promise<void>` | Deletes from DB, filters from array |

---

## useUIStore (src/stores/ui.ts)

**Exported types:** `ViewType`, `Theme`, `SyncInterval`

```typescript
ViewType = 'today' | 'inbox' | 'calendar' | 'planner' | 'list' | 'search' | 'settings'
Theme = 'light' | 'dark' | 'system'
SyncInterval = 5 | 15 | 30 | 60 | null
```

**State:**

```typescript
sidebarOpen: boolean              // default true
detailsPanelOpen: boolean         // default false
selectedTaskId: string | null     // default null
currentView: ViewType             // default 'today'
currentListId: string | null      // default null
theme: Theme                      // default 'system'
searchQuery: string               // default ''
syncIntervalMinutes: SyncInterval // default null (disabled)
```

**Persisted to localStorage** (key `tasky-ui`): `sidebarOpen`, `theme`, `syncIntervalMinutes` only.

**Key behaviors:**
- `selectTask(id)` -- auto-opens details panel
- `navigateTo(view)` -- resets selection, closes details panel

**No DB dependency** -- this is pure client-side state.

---

## useSyncStore (src/stores/sync.ts) -- 689 lines

**State:**

```typescript
// CalDAV
accounts: CalDavAccount[]
calendarMaps: CalDavCalendarMap[]

// GitHub
githubAccounts: GitHubAccount[]
githubRepoMaps: GitHubRepoMap[]

// Shared sync status
syncStatus: 'idle' | 'syncing' | 'error' | 'success'
lastSyncError: string | null
lastSyncAt: string | null
isSyncing: boolean
```

**Key actions:**

| Action | Signature | Key Logic |
|---|---|---|
| `loadAccounts` | `(adapter) => Promise<void>` | Loads all 4 tables in parallel (CalDAV accounts, maps, GitHub accounts, repo maps) |
| `syncAll` | `(adapter, tasks, lists, onTasksChanged, onListsChanged) => Promise<void>` | Guards against concurrent sync, iterates all enabled accounts |
| `syncPending` | `(adapter, pendingListIds, tasks, lists, ...) => Promise<void>` | Targeted sync for specific lists; skips if all pending tasks are Inbox (local-only) |
| `syncAccount` | `(adapter, accountId, tasks, lists, ...) => Promise<SyncResult>` | Core CalDAV sync: fetch remote -> push pending -> delete -> merge results |
| `syncGitHubAccount` | `(adapter, accountId, tasks, ...) => Promise<SyncResult>` | GitHub sync (issues) |
| `addAccount` / `updateAccount` / `deleteAccount` | CalDAV account CRUD |
| `addGitHubAccount` / `updateGitHubAccount` / `deleteGitHubAccount` | GitHub account CRUD |
| `testConnection` / `testGitHubConnection` | Test server connectivity |
| `discoverCalendars` / `discoverGitHubRepos` | Discover available calendars/repos |
| `linkCalendar` / `unlinkCalendar` | Link/unlink CalDAV calendars to lists |
| `linkGitHubRepo` / `unlinkGitHubRepo` | Link/unlink GitHub repos to lists |
| `updateGitHubRepoMap` | `(adapter, listId, {query?, readOnly?}) => Promise<void>` | Update per-repo settings |

### Sync algorithm (CalDAV)

1. Filter tasks by list IDs matching calendar maps
2. Extract pending root tasks (parentId===null, syncStatus==='pending')
3. Build `TaskPushInput[]`, call `providerSync('caldav', ...)`
4. Process push results: update local tasks with `caldavUid`, `etag`, `syncStatus:'synced'`
5. Track `justPushedUids` to avoid duplicate creation
6. Process remote tasks: update existing (skip if same etag, mark conflict if pending), create new
7. Skip events-only calendar maps
8. Update `lastSyncedAt`, call `onTasksChanged()` callback

### GitHub sync

Nearly identical to CalDAV, but reuses `caldavUid` for issue numbers, `etag` for `updated_at`. Config includes `query` and `read_only`.

### Helper functions (private)

- `priorityNumToStr(p: number | null)` -- RFC 5545 priority mapping (1-3=high, 4-6=medium, 7-9=low)
- `rruleToString(r: RecurrenceRule)` -- serializes to RRULE string
- `parseRRule(rrule: string)` -- parses RRULE string to object

---

## useEventStore (src/stores/events.ts)

**State:**

```typescript
events: Map<string, CalendarEvent>              // keyed by "{calendarHref}:{remoteId}"
calendarVisibility: Record<string, boolean>     // keyed by calendarHref
loading: boolean
error: string | null
```

**Persisted to localStorage** (key `tasky-calendar-visibility`): `calendarVisibility` only.

**Actions:**

| Action | Key Logic |
|---|---|
| `fetchEvents(serverUrl, username, password, calendarHref, rangeStart, rangeEnd)` | Calls `providerFetchEvents('caldav', ...)`, replaces events for that calendar href |
| `clearEvents()` | Resets events to empty Map |
| `toggleCalendarVisibility(calendarHref)` | Toggles boolean (default: visible) |
| `isCalendarVisible(calendarHref)` | Returns visibility state (default: true) |

Events are VEVENT data fetched from CalDAV for calendar display. They are **not persisted to SQLite** -- fetched on demand.

---

## Cross-Store Dependency Map

```
src/types/types.ts          <-- Canonical domain types (no deps)
    ^
src/lib/utils.ts            <-- Pure utilities (clsx, twMerge)
    ^
src/providers/types.ts      <-- Provider wire types (no deps)
    ^
src/providers/ipc.ts        <-- IPC bridge (@tauri-apps/api/core)
    ^
src/db/repository.ts        <-- SQL repositories (@/types)
    ^
src/stores/tasks.ts --------+-- (repo, utils, types)
src/stores/lists.ts --------+-- (repo, utils, types)
src/stores/ui.ts            +-- (no DB deps)
src/stores/events.ts -------+-- (providers/ipc)
src/stores/sync.ts ---------+-- (repo, utils, providers/ipc, providers/types, types)
    ^
src/hooks/use-auto-sync.ts  <-- Sole cross-store orchestrator (stores, repo, types)
```
