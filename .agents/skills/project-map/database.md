# Database Layer

> Part of the `project-map` skill. See `SKILL.md` for overview, `data-model.md` for SQL schema.

## DatabaseAdapter Interface (src/db/repository.ts)

```typescript
interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>
  select<T>(sql: string, params?: unknown[]): Promise<T[]>
}
```

The core abstraction over the actual SQLite database. Components never use the Tauri SQL plugin directly -- they use this interface.

## Adapter Factory (src/lib/database.ts)

```typescript
getDatabase(): Promise<Database>
// Lazy-initializes and caches a single SQLite connection to 'sqlite:tasky.db'
// Uses @tauri-apps/plugin-sql

createAdapter(database: Database): DatabaseAdapter
// Wraps the Tauri Database object into the DatabaseAdapter interface
```

## Repositories (src/db/repository.ts)

Four factory functions (Phase 6 replaced old provider-specific repos with generic ones):

### createTaskRepository(db)

| Method | Signature | SQL pattern |
|---|---|---|
| `getAll` | `() => Promise<Task[]>` | `SELECT * FROM tasks ORDER BY created_at DESC` |
| `getById` | `(id) => Promise<Task \| null>` | `WHERE id = ?` |
| `getByList` | `(listId) => Promise<Task[]>` | `WHERE list_id = ? ORDER BY created_at DESC` |
| `getDueToday` | `() => Promise<Task[]>` | `WHERE date(due_date) = ? AND completed = 0 ORDER BY due_date ASC` |
| `getInbox` | `() => Promise<Task[]>` | `WHERE list_id IS NULL AND completed = 0` |
| `create` | `(task: NewTask & {id}) => Promise<void>` | INSERT with 20 columns; JSON.stringifies `tags` and `recurrence` |
| `update` | `(id, updates: Partial<Task>) => Promise<void>` | Dynamic UPDATE (builds SET clause from provided fields only, always bumps `updated_at`) |
| `delete` | `(id) => Promise<void>` | `DELETE FROM tasks WHERE id = ?` |

### createListRepository(db)

| Method | Signature |
|---|---|
| `getAll` | `() => Promise<TaskList[]>` |
| `getById` | `(id) => Promise<TaskList \| null>` |
| `create` | `(list: NewTaskList & {id}) => Promise<void>` |
| `update` | `(id, updates: Partial<TaskList>) => Promise<void>` |
| `delete` | `(id) => Promise<void>` |

### createProviderAccountRepository(db)

`getAll`, `getById`, `create`, `update`, `delete`, `setLastSynced(id, at)`. Operates on `provider_accounts` table. Stores/retrieves `credentials` as JSON.

### createProviderMapRepository(db)

`getAll`, `getByAccount(accountId)`, `getByList(listId)`, `create(map)`, `update(id, updates)`, `delete(id)`. Operates on `provider_maps` table. `id` is the primary key (not `listId`). Stores/retrieves `settings` as JSON.

### Standalone functions

- `getSetting(db, key): Promise<string | null>` -- reads from `settings` table
- `setSetting(db, key, value): Promise<void>` -- `INSERT OR REPLACE` into `settings`

## Row Mappers

Private functions in `repository.ts` that convert snake_case DB columns to camelCase TypeScript objects:

- `rowToTask` -- JSON-parses `tags` (string -> string[]) and `recurrence` (string -> RecurrenceRule | null), coerces `completed` (0/1 -> boolean), maps `remote_id` → `remoteId`
- `rowToList` -- maps `remote_url` → `remoteUrl`
- `rowToProviderAccount` -- JSON-parses `credentials`
- `rowToProviderMap` -- JSON-parses `settings`

## Migrations (src/db/migrate.ts + src/db/migrations/index.ts)

`runMigrations(db: DatabaseAdapter)`:
1. Creates `schema_migrations` table if not exists
2. Reads all applied versions
3. Iterates `MIGRATIONS` array (exported from `migrations/index.ts`), applies unapplied SQL, inserts version record

10 migrations total (v1-v10). Migration v10 (Phase 6):
- Creates `provider_accounts` and `provider_maps` tables
- Migrates existing `caldav_accounts` → `provider_accounts` (type='caldav', credentials JSON)
- Migrates existing `github_accounts` → `provider_accounts` (type='github', credentials JSON)
- Migrates existing `caldav_calendar_map` → `provider_maps` (settings JSON)
- Migrates existing `github_repo_map` → `provider_maps` (settings JSON)
- Renames `tasks.caldav_uid` → `tasks.remote_id`
- Renames `lists.caldav_url` → `lists.remote_url`
- Drops old tables

See `data-model.md` for the cumulative schema.

## Utility Functions (src/lib/utils.ts)

| Function | Signature | Purpose |
|---|---|---|
| `cn` | `(...inputs: ClassValue[]) => string` | Tailwind class merger (`clsx` + `twMerge`) |
| `generateId` | `() => string` | `crypto.randomUUID()` |
| `minutesToHHMM` | `(minutes: number) => string` | e.g. 90 -> "01:30" |
| `hhmmToMinutes` | `(value: string) => number \| null` | Parses "HH:MM" or plain number to minutes |
| `localDateFromString` | `(dateStr, hours?, minutes?) => Date` | Parses YYYY-MM-DD to local Date (avoids UTC midnight shift) |
| `formatDate` | `(date: string \| null, format?: 'short' \| 'long') => string` | Browser locale via `toLocaleDateString` |
| `isToday` | `(date: string \| null) => boolean` | Checks if date is today |
| `isOverdue` | `(date: string \| null) => boolean` | Checks if date is before today |
