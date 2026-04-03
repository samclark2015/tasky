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
| `updateTask` | `(adapter, id, updates: Partial<Task>) => Promise<void>` | Auto-sets `syncStatus: 'pending'` for remote-linked tasks (has `remoteId`) unless caller explicitly sets syncStatus |
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
| `createList` | `(adapter, name, color?) => Promise<TaskList>` | Generates UUID, sets `remoteUrl: null` |
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

## useSyncStore (src/stores/sync.ts) -- ~464 lines

**Unified, provider-agnostic sync store (Phase 6 rewrite).**

**State:**

```typescript
// Unified state (replaces separate CalDAV + GitHub state)
accounts: ProviderAccount[]
maps: ProviderMap[]

// Shared sync status
syncStatus: 'idle' | 'syncing' | 'error' | 'success'
lastSyncError: string | null
lastSyncAt: string | null
isSyncing: boolean
```

**Key actions:**

| Action | Signature | Key Logic |
|---|---|---|
| `loadAccounts` | `(adapter) => Promise<void>` | Loads provider_accounts + provider_maps tables |
| `addAccount` | `(adapter, providerType, displayName, credentials) => Promise<ProviderAccount>` | Inserts into provider_accounts |
| `updateAccount` | `(adapter, id, updates) => Promise<void>` | Partial update |
| `deleteAccount` | `(adapter, id) => Promise<void>` | Cascade-deletes maps too |
| `testConnection` | `(providerType, credentials) => Promise<{ok, error?}>` | Calls `providerTestConnection` IPC |
| `discoverSources` | `(providerType, credentials) => Promise<ProviderCalendar[]>` | Calls `providerDiscover` IPC |
| `linkSource` | `(adapter, accountId, sourceId, sourceName, listId, settings) => Promise<void>` | Inserts into provider_maps |
| `unlinkSource` | `(adapter, mapId) => Promise<void>` | Deletes map by `map.id` (not listId) |
| `updateMap` | `(adapter, mapId, settings) => Promise<void>` | Updates map settings JSON |
| `syncAccount` | `(adapter, accountId, tasks, lists, ...) => Promise<SyncResult>` | Unified sync for any provider: builds config as `{...account.credentials, ...map.settings}`, dispatches to Rust |
| `syncAll` | `(adapter, tasks, lists, onTasksChanged, onListsChanged) => Promise<void>` | Guards against concurrent sync, iterates enabled accounts |
| `syncPending` | `(adapter, pendingListIds, tasks, lists, ...) => Promise<void>` | Targeted sync for specific lists |

### Sync algorithm (unified)

1. Filter maps for the given account
2. For each map with a listId: filter tasks by listId, extract pending root tasks
3. Build config: `{ ...account.credentials, ...map.settings }` (CalDAV: server_url+username+password+events_only+sync_token; GitHub: token+query+read_only)
4. Call `providerSync(account.providerType, config, ...)`
5. Process push results: update local tasks with `remoteId`, `etag`, `syncStatus:'synced'`
6. Process remote tasks: update existing (skip same etag, mark conflict if pending), create new
7. Skip events-only maps (listId===null)
8. Update `lastSyncedAt`, call `onTasksChanged()` callback

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
