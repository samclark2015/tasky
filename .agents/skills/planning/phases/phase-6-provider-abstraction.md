# Phase 6: Provider Abstraction

**Goal:** Make the entire TypeScript layer provider-agnostic. Adding a new sync provider requires **only Rust code** — zero TS changes. Provider-specific knowledge (credential schemas, form metadata, config shapes) moves to the Rust `providers` crate and is served to the frontend via IPC.

**Dependencies:** Phase 4 (CalDAV Sync) + GitHub Provider (post-Phase 5)

## Design Decisions

1. **Unified DB tables** — replace 4 provider-specific tables (`caldav_accounts`, `caldav_calendar_map`, `github_accounts`, `github_repo_map`) with `provider_accounts` + `provider_maps`
2. **Column renaming** — `tasks.caldav_uid` → `remote_id`, `lists.caldav_url` → `remote_url`
3. **Rust-served metadata** — providers declare form schemas, icons, and labels via a `metadata()` trait method; TS fetches and renders dynamically
4. **Pass-through credentials** — credentials JSON stored in `provider_accounts` is passed directly to Rust as the config; map-level settings from `provider_maps.settings` merged in
5. **Drop old tables** — migration drops old provider-specific tables after data transfer (no backup tables)

## Dependency Graph

```
6.1 (Rust Metadata) ──┐
                       ├── 6.4 (Generic Settings UI)
6.2 (Unified DB)  ─────┤
       │                │
       └── 6.3 (Unified Sync Store) ── 6.5 (Cleanup)
```

Recommended execution order: 6.2 → 6.1 → 6.3 → 6.4 → 6.5

---

## Sub-Phase 6.1: Rust Provider Metadata System

**Goal:** Extend the Rust `SyncProvider` trait with a `metadata()` method and wire it through IPC so the frontend can discover providers and render forms without hardcoded knowledge.

### Objectives
1. Define metadata types in `providers/src/lib.rs`
2. Add `metadata()` to `SyncProvider` trait
3. Implement on `CalDavProvider` and `GitHubProvider`
4. Add dispatch functions for listing/querying provider metadata
5. Wire through Tauri IPC commands
6. Add TS types and IPC bridge functions

### Tasks

#### 6.1.1 Rust metadata types (`providers/src/lib.rs`)

- [ ] Add `ProviderFieldDef` struct:
  - `key: String` — credential field key ("server_url", "token")
  - `label: String` — display label ("Server URL", "Personal Access Token")
  - `field_type: String` — "text", "password", "url"
  - `required: bool`
  - `placeholder: Option<String>`
  - `help_text: Option<String>`

- [ ] Add `ProviderMapFieldDef` struct:
  - `key: String` — map-level setting key ("query", "read_only", "events_only")
  - `label: String` — display label
  - `field_type: String` — "text", "boolean"
  - `default_value: Option<serde_json::Value>`
  - `help_text: Option<String>`

- [ ] Add `ProviderMetadata` struct:
  - `id: String` — "caldav", "github"
  - `display_name: String` — "CalDAV", "GitHub"
  - `icon: String` — Lucide icon name ("wifi", "github")
  - `description: String`
  - `credential_fields: Vec<ProviderFieldDef>`
  - `map_fields: Vec<ProviderMapFieldDef>`
  - `source_noun: String` — "calendar", "repository"
  - `source_noun_plural: String` — "calendars", "repositories"
  - `supports_events: bool` — CalDAV true, GitHub false

#### 6.1.2 Trait extension

- [ ] Add `fn metadata() -> ProviderMetadata` to `SyncProvider` trait

#### 6.1.3 CalDAV metadata implementation (`providers/src/caldav/mod.rs`)

- [ ] Implement `metadata()` returning:
  - credential_fields: server_url (url, required), username (text, required), password (password, required)
  - map_fields: events_only (boolean, default false), sync_token (hidden/internal — omit from map_fields since it's not user-facing)
  - source_noun: "calendar" / "calendars"
  - supports_events: true

#### 6.1.4 GitHub metadata implementation (`providers/src/github/mod.rs`)

- [ ] Implement `metadata()` returning:
  - credential_fields: token (password, required, placeholder "ghp_...")
  - map_fields: query (text, default null, help_text about search syntax), read_only (boolean, default false)
  - source_noun: "repository" / "repositories"
  - supports_events: false

#### 6.1.5 Dispatch functions (`providers/src/lib.rs::dispatch`)

- [ ] `list_providers() -> Vec<ProviderMetadata>` — returns metadata for all registered providers
- [ ] `provider_metadata(id: &str) -> Result<ProviderMetadata, String>` — returns metadata for a specific provider

#### 6.1.6 Tauri IPC commands (`src-tauri/src/providers.rs`)

- [ ] `#[tauri::command] pub async fn list_providers() -> Vec<ProviderMetadata>`
- [ ] `#[tauri::command] pub async fn get_provider_metadata(provider: String) -> Result<ProviderMetadata, String>`
- [ ] Register both commands in `src-tauri/src/lib.rs`

#### 6.1.7 TS IPC bridge (`src/providers/ipc.ts`, `src/providers/types.ts`)

- [ ] Add TS types: `ProviderFieldDef`, `ProviderMapFieldDef`, `ProviderMetadata`
- [ ] Add wire types and deserializers for metadata (snake_case → camelCase)
- [ ] Add `providerListProviders(): Promise<ProviderMetadata[]>`
- [ ] Add `providerGetMetadata(providerId: string): Promise<ProviderMetadata>`

### Deliverables
- `providerListProviders()` returns both CalDAV and GitHub metadata with correct field definitions
- No existing functionality broken — this is purely additive

### Files Touched
`providers/src/lib.rs`, `providers/src/caldav/mod.rs`, `providers/src/github/mod.rs`, `src-tauri/src/providers.rs`, `src-tauri/src/lib.rs`, `src/providers/ipc.ts`, `src/providers/types.ts`

---

## Sub-Phase 6.2: Unified DB Schema + Repository

**Goal:** Replace the 4 provider-specific tables with 2 generic tables. Rename `caldav_uid` → `remote_id` and `caldav_url` → `remote_url`.

### Objectives
1. Write migration v10 to create unified tables, migrate data, rename columns, drop old tables
2. Replace provider-specific TS types with generic `ProviderAccount` and `ProviderMap`
3. Replace 4 repository factories with 2 generic ones
4. Update Task/List types and repos for renamed columns

### Tasks

#### 6.2.1 Migration v10 (`src/db/migrations/index.ts`)

- [ ] Create `provider_accounts` table:
  ```sql
  CREATE TABLE IF NOT EXISTS provider_accounts (
    id TEXT PRIMARY KEY,
    provider_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    credentials TEXT NOT NULL DEFAULT '{}',
    last_synced_at TEXT,
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ```

- [ ] Create `provider_maps` table:
  ```sql
  CREATE TABLE IF NOT EXISTS provider_maps (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    list_id TEXT,
    source_id TEXT NOT NULL,
    source_name TEXT,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ```

- [ ] Migrate CalDAV accounts:
  ```sql
  INSERT INTO provider_accounts (id, provider_type, display_name, credentials, last_synced_at, sync_enabled, created_at, updated_at)
    SELECT id, 'caldav', display_name,
      json_object('server_url', server_url, 'username', username, 'password', password),
      last_synced_at, sync_enabled, created_at, updated_at
    FROM caldav_accounts;
  ```

- [ ] Migrate GitHub accounts:
  ```sql
  INSERT INTO provider_accounts (id, provider_type, display_name, credentials, last_synced_at, sync_enabled, created_at, updated_at)
    SELECT id, 'github', display_name,
      json_object('token', token),
      last_synced_at, sync_enabled, created_at, updated_at
    FROM github_accounts;
  ```

- [ ] Migrate CalDAV calendar maps:
  ```sql
  INSERT INTO provider_maps (id, account_id, list_id, source_id, source_name, settings, created_at, updated_at)
    SELECT id, account_id, list_id, calendar_href, NULL,
      json_object('events_only', events_only, 'sync_token', sync_token),
      created_at, updated_at
    FROM caldav_calendar_map;
  ```

- [ ] Migrate GitHub repo maps:
  ```sql
  INSERT INTO provider_maps (id, account_id, list_id, source_id, source_name, settings, created_at, updated_at)
    SELECT id, account_id, list_id, repo_full_name, repo_full_name,
      json_object('query', query, 'read_only', read_only),
      created_at, updated_at
    FROM github_repo_map;
  ```

- [ ] Rename columns:
  ```sql
  ALTER TABLE tasks RENAME COLUMN caldav_uid TO remote_id;
  ALTER TABLE lists RENAME COLUMN caldav_url TO remote_url;
  ```

- [ ] Drop old tables:
  ```sql
  DROP TABLE IF EXISTS caldav_calendar_map;
  DROP TABLE IF EXISTS caldav_accounts;
  DROP TABLE IF EXISTS github_repo_map;
  DROP TABLE IF EXISTS github_accounts;
  ```

- [ ] Create indexes:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_provider_accounts_type ON provider_accounts(provider_type);
  CREATE INDEX IF NOT EXISTS idx_provider_maps_account ON provider_maps(account_id);
  CREATE INDEX IF NOT EXISTS idx_provider_maps_list ON provider_maps(list_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_remote_id ON tasks(remote_id);
  ```

#### 6.2.2 TS types (`src/types/types.ts`)

- [ ] Remove `CalDavAccount`, `CalDavCalendarMap`, `GitHubAccount`, `GitHubRepoMap`
- [ ] Add `ProviderAccount`:
  ```typescript
  interface ProviderAccount {
    id: string;
    providerType: string;
    displayName: string;
    credentials: Record<string, unknown>;
    lastSyncedAt: string | null;
    syncEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }
  ```
- [ ] Add `ProviderMap`:
  ```typescript
  interface ProviderMap {
    id: string;
    accountId: string;
    listId: string | null;
    sourceId: string;
    sourceName: string | null;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }
  ```
- [ ] Rename `Task.caldavUid` → `Task.remoteId`
- [ ] Rename `TaskList.caldavUrl` → `TaskList.remoteUrl`
- [ ] Remove `DiscoveredCalendar` and `SyncResult` if unused elsewhere (verify with grep)

#### 6.2.3 Repository (`src/db/repository.ts`)

- [ ] Remove `rowToAccount`, `rowToCalendarMap`, `rowToGitHubAccount`, `rowToGitHubRepoMap`
- [ ] Remove `createAccountRepository`, `createCalendarMapRepository`, `createGitHubAccountRepository`, `createGitHubRepoMapRepository`
- [ ] Add `rowToProviderAccount()` — maps `provider_type` → `providerType`, parses `credentials` JSON
- [ ] Add `rowToProviderMap()` — maps `account_id` → `accountId`, `source_id` → `sourceId`, parses `settings` JSON
- [ ] Add `createProviderAccountRepository(db)` — generic CRUD:
  - `getAll()` — all accounts
  - `getByType(providerType)` — filtered by provider
  - `getById(id)` — single account
  - `create(account)` — INSERT with JSON.stringify(credentials)
  - `update(id, updates)` — UPDATE with JSON.stringify(credentials) if present
  - `delete(id)` — DELETE + cascade delete maps for this account
- [ ] Add `createProviderMapRepository(db)` — generic CRUD:
  - `getByAccount(accountId)` — maps for an account
  - `getByList(listId)` — maps linked to a list
  - `getAll()` — all maps
  - `create(map)` — INSERT with JSON.stringify(settings)
  - `update(id, updates)` — UPDATE with JSON.stringify(settings) if present
  - `delete(id)` — DELETE
  - `deleteByAccount(accountId)` — DELETE all maps for an account
- [ ] Update `rowToTask()` — `caldav_uid` → `remote_id` → `remoteId`
- [ ] Update `rowToList()` — `caldav_url` → `remote_url` → `remoteUrl`
- [ ] Update `createTaskRepository()` — INSERT/UPDATE use `remote_id` column
- [ ] Update `createListRepository()` — INSERT/UPDATE use `remote_url` column

### Deliverables
- App starts with migrated data
- Existing CalDAV/GitHub accounts readable via new generic repositories
- Task and list records use `remote_id`/`remote_url` columns

### Files Touched
`src/db/migrations/index.ts`, `src/types/types.ts`, `src/db/repository.ts`, `src/types/index.ts` (exports)

---

## Sub-Phase 6.3: Unified Sync Store

**Goal:** Replace duplicated `syncAccount()` / `syncGitHubAccount()` with a single generic `syncAccount()`. Replace separate state slices with unified arrays.

**Dependencies:** Sub-Phase 6.2 (needs unified types and tables)

### Objectives
1. Replace 4 separate state arrays with 2 generic arrays
2. Consolidate all duplicate account/map actions
3. Unify sync orchestration into a single `syncAccount()`
4. Simplify `syncAll()` and `syncPending()`

### Tasks

#### 6.3.1 State consolidation (`src/stores/sync.ts`)

- [ ] Replace state shape:
  ```
  // Old:
  accounts: CalDavAccount[]
  calendarMaps: CalDavCalendarMap[]
  githubAccounts: GitHubAccount[]
  githubRepoMaps: GitHubRepoMap[]

  // New:
  accounts: ProviderAccount[]
  maps: ProviderMap[]
  ```

#### 6.3.2 Action consolidation

- [ ] `addAccount(providerType, displayName, credentials)` — replaces `addAccount` + `addGitHubAccount`
- [ ] `updateAccount(id, updates)` — replaces `updateAccount` + `updateGitHubAccount`
- [ ] `deleteAccount(id)` — replaces `deleteAccount` + `deleteGitHubAccount`; also deletes associated maps
- [ ] `testConnection(providerType, credentials)` — replaces `testConnection` + `testGitHubConnection`; calls `providerTestConnection(providerType, credentials)`
- [ ] `discoverSources(providerType, credentials)` — replaces `discoverCalendars` + `discoverGitHubRepos`; calls `providerDiscoverCalendars(providerType, credentials)`
- [ ] `linkSource(accountId, sourceId, sourceName, listId, settings)` — replaces `linkCalendar` + `linkGitHubRepo`
- [ ] `unlinkSource(mapId)` — replaces `unlinkCalendar` + `unlinkGitHubRepo`
- [ ] `updateMap(mapId, settings)` — replaces `updateGitHubRepoMap`; generic settings update

#### 6.3.3 Unified `syncAccount(accountId)` — replaces `syncAccount` + `syncGitHubAccount`

The key design: credentials JSON from `provider_accounts` IS the base config. Map-level settings get merged in. The `providerType` field determines the IPC provider ID.

- [ ] Implementation:
  ```
  1. Look up account by ID → get providerType + credentials
  2. Find all maps for this account that have a linked listId
  3. For each map:
     a. Build config = { ...account.credentials, ...map.settings }
     b. Gather dirty tasks from the linked list where syncStatus = 'pending'
     c. Build pushInputs using task.remoteId (was caldavUid)
     d. Build deleteInputs from deleted tasks
     e. Call providerSync(account.providerType, config, map.sourceId, pushInputs, deleteInputs)
     f. Reconcile pushed results (update remoteId, etag, href on local tasks)
     g. Reconcile remote tasks (create/update local tasks, set remoteId)
  4. Update account.lastSyncedAt
  ```

#### 6.3.4 Simplify `syncAll()` and `syncPending()`

- [ ] `syncAll()`:
  ```
  accounts.filter(a => a.syncEnabled).forEach(a => syncAccount(a.id))
  ```
  No more iterating CalDAV and GitHub accounts separately.

- [ ] `syncPending(pendingListIds)`:
  ```
  1. Find maps where listId is in pendingListIds
  2. Get unique accountIds from those maps
  3. syncAccount(each unique accountId)
  ```

#### 6.3.5 Update references

- [ ] Update `src/hooks/use-auto-sync.ts` if it references old types or store shape
- [ ] Update any store consumers that reference `calendarMaps`, `githubAccounts`, `githubRepoMaps`

### Technical Notes

- Helper functions `priorityNumToStr`, `rruleToString`, `parseRRule` remain unchanged — they are provider-agnostic utilities
- The reconciliation logic (matching remote tasks to local by `remoteId`, create vs update decision) is identical between the old CalDAV and GitHub sync functions — extract into a shared helper if not already

### Deliverables
- Single `syncAccount()` handles both CalDAV and GitHub (and any future providers)
- `syncAll()` and `syncPending()` are provider-agnostic
- Full sync round-trip verified for both CalDAV and GitHub

### Files Touched
`src/stores/sync.ts` (major rewrite), `src/hooks/use-auto-sync.ts`, any other consumers of the old store shape

---

## Sub-Phase 6.4: Generic Settings UI

**Goal:** Replace all provider-specific UI components with generic components driven by `ProviderMetadata` from Rust.

**Dependencies:** Sub-Phase 6.1 (needs metadata IPC), Sub-Phase 6.2/6.3 (needs unified types)

### Objectives
1. Delete all provider-specific UI components
2. Build generic metadata-driven form components
3. Dynamic icon rendering from provider metadata
4. Generic add/edit account modals with provider selection

### Tasks

#### 6.4.1 Generic `ProviderAccountRow` — replaces `CalDavAccountRow` + `GitHubAccountRow`

- [ ] Renders icon from `metadata.icon` (Lucide dynamic icon lookup)
- [ ] Shows display name, provider label (`metadata.display_name`), linked source count
- [ ] Uses `metadata.source_noun_plural` for labels (e.g., "3 calendars" or "2 repositories")
- [ ] Expandable to show linked sources with per-source settings
- [ ] Edit and delete buttons

#### 6.4.2 Generic `SourceSettingsInline` — replaces `RepoSettingsInline`

- [ ] Renders map-level fields dynamically from `metadata.map_fields`
- [ ] For each `ProviderMapFieldDef`:
  - `field_type: "text"` → text input
  - `field_type: "boolean"` → checkbox
- [ ] Saves changes via `updateMap(mapId, settings)`
- [ ] Shows help text from `ProviderMapFieldDef.help_text`

#### 6.4.3 Generic `AddAccountForm` — replaces `AddCalDavAccountForm` + `AddGitHubAccountForm`

- [ ] Renders credential fields from `metadata.credential_fields`
- [ ] For each `ProviderFieldDef`:
  - `field_type: "text"` → text input
  - `field_type: "password"` → password input
  - `field_type: "url"` → url input
  - Placeholder from `ProviderFieldDef.placeholder`
  - Required validation from `ProviderFieldDef.required`
- [ ] Flow: fill credential fields → test connection → discover sources → link/unlink
- [ ] Source list uses `metadata.source_noun` for labels
- [ ] If `metadata.supports_events`, show "Events only" toggle per source
- [ ] Link creates a new list (named from source display name) + provider map entry
- [ ] Unlink removes the provider map (optionally deletes the list)

#### 6.4.4 Simplified `AddAccountModal`

- [ ] Step 1: Choose provider type from `listProviders()` results
- [ ] Step 2: Render `AddAccountForm` with chosen provider's metadata

#### 6.4.5 Simplified `EditAccountModal`

- [ ] Loads metadata for the account's `providerType`
- [ ] Renders form pre-filled with current `account.credentials`
- [ ] Same discover/link/unlink flow as Add

#### 6.4.6 Dynamic icon rendering

- [ ] Create icon lookup utility: maps Lucide icon name strings to React components
- [ ] Use a static map of known icons (wifi, github, plus any future ones) or dynamic import
- [ ] Fallback to a generic "plug" or "cloud" icon for unknown names

#### 6.4.7 Component removal

- [ ] Delete `CalDavAccountRow`
- [ ] Delete `GitHubAccountRow`
- [ ] Delete `RepoSettingsInline`
- [ ] Delete `AddCalDavAccountForm`
- [ ] Delete `AddGitHubAccountForm`
- [ ] Simplify `EditingAccount` type from discriminated union to just `ProviderAccount`

#### 6.4.8 Account list rendering

- [ ] `SettingsView` renders all `accounts` in a single list (grouped by `providerType` or flat)
- [ ] Each account rendered via `ProviderAccountRow` with its provider's metadata

### Deliverables
- Settings page renders both CalDAV and GitHub accounts via generic components
- Add/edit/delete accounts works for both providers
- Discover + link/unlink sources works
- Per-source settings render and save correctly
- No provider-specific UI code remains

### Files Touched
`src/views/settings/index.tsx` (major rewrite — ~1042 lines down to ~500-600)

---

## Sub-Phase 6.5: Cleanup & Verification

**Goal:** Remove all remaining provider-specific references and verify end-to-end.

**Dependencies:** All prior sub-phases complete

### Tasks

#### 6.5.1 Dead code removal

- [ ] Verify `DiscoveredCalendar` and `SyncResult` removed from `src/types/types.ts` (or still used — check with grep)
- [ ] Verify no remaining `CalDavAccount`, `GitHubAccount`, `CalDavCalendarMap`, `GitHubRepoMap` references in TS
- [ ] Verify no remaining `caldavUid` or `caldavUrl` references in TS
- [ ] Verify no remaining `caldav_uid` or `caldav_url` in SQL strings (except historical migrations v1-v9)
- [ ] Update `src/types/index.ts` barrel exports (remove old, add new)
- [ ] Update `src/db/index.ts` if it exports old repository functions

#### 6.5.2 Build verification

- [ ] `cargo build` — Rust compiles clean
- [ ] `npx tsc --noEmit` — TypeScript type-check passes
- [ ] App starts without errors

#### 6.5.3 Functional verification

- [ ] Manual smoke test: add CalDAV account, test connection, discover calendars, link, sync
- [ ] Manual smoke test: add GitHub account, test connection, discover repos, link, sync
- [ ] Verify existing data survives migration (if testing with real data)
- [ ] Verify `syncAll()` syncs both provider types
- [ ] Verify `syncPending()` correctly resolves accounts from dirty list IDs

#### 6.5.4 Planning docs

- [ ] Update `PROGRESS.md` to mark Phase 6 complete with implementation notes

### Files Touched
Various cleanup across `src/types/`, `src/db/`, any files with stale imports

---

## Estimated Scope

| Sub-Phase | Files Modified | Lines Changed (est.) | Risk |
|-----------|---------------|---------------------|------|
| 6.1 Rust Metadata | 7 | ~250 | Low |
| 6.2 Unified DB | 3-4 | ~350 | Medium (data migration) |
| 6.3 Sync Store | 2-3 | ~300 | Medium (sync logic) |
| 6.4 Generic Settings UI | 1 (large) | ~500 | Medium |
| 6.5 Cleanup | 5-8 | ~50 | Low |

## Technical Notes

- `sync_token` on CalDAV maps is stored in the `settings` JSON blob alongside `events_only`; it is not user-facing so it does NOT appear in `metadata.map_fields`
- The `credentials` column stores a JSON string; in the TS type it's `Record<string, unknown>`; repositories `JSON.parse()` on read and `JSON.stringify()` on write
- The `settings` column on `provider_maps` works the same way — JSON blob for `events_only`, `sync_token`, `query`, `read_only`, etc.
- `events_only` is a CalDAV-specific concept but it's stored generically in map settings; the generic UI renders it via `map_fields` from metadata (only CalDAV declares it)
- The unified `syncAccount()` builds config as `{ ...account.credentials, ...map.settings }` — this means CalDAV maps contribute `events_only` and `sync_token` to the config, and GitHub maps contribute `query` and `read_only`. The Rust provider implementations already handle these via their respective config structs with `#[serde(default)]`.
