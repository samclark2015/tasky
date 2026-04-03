# Rust Backend & Sync Providers

> Part of the `project-map` skill. See `SKILL.md` for overview and directory tree.

## Tauri App (src-tauri/)

### main.rs (5 lines)

Minimal binary entry point. Calls `tasky_lib::run()`. Hides console window on Windows in release builds.

### lib.rs (146 lines)

Bootstraps the entire Tauri application.

**Structs:**
- `ThemeMenuState<R: Runtime>` -- holds references to Light/Dark/System `CheckMenuItem`s

**IPC commands registered:**
- `sync_theme` -- syncs theme from frontend to native menu check state
- `test_connection` -- delegates to `tasky_providers::dispatch`
- `discover_calendars` -- delegates to `tasky_providers::dispatch`
- `sync_account` -- delegates to `tasky_providers::dispatch`
- `fetch_events` -- delegates to `tasky_providers::dispatch`
- `list_providers` -- returns list of registered provider IDs (Phase 6)
- `get_provider_metadata` -- returns ProviderMetadata for a given provider ID (Phase 6)
- `reset_database` (debug only) -- deletes `tasky.db` from app data dir

**Plugins loaded:**
- `tauri_plugin_sql` (SQLite, preloads `tasky.db`)
- `tauri_plugin_notification`

**Setup callback:**
- Creates "Theme" submenu (View menu) with Light/Dark/System check items
- Debug: creates "Developer" submenu with "Reset Database" and "Reload" items
- Menu event handler: theme items update checks + emit `set-theme` event to webview

### providers.rs

Thin IPC wrappers delegating to `tasky_providers::dispatch`.

**Commands:**

```rust
pub async fn test_connection(provider: String, config: Value)
    -> Result<ConnectionResult, String>

pub async fn discover_calendars(provider: String, config: Value)
    -> Result<DiscoverResult, String>

pub async fn sync_account(
    provider: String, config: Value,
    calendar_href: String,
    pending_tasks: Vec<TaskPushInput>,
    deleted_hrefs: Vec<TaskDeleteInput>,
) -> Result<SyncOutput, String>

pub async fn fetch_events(
    provider: String, config: Value,
    calendar_href: String,
    range_start: String, range_end: String,
) -> Result<FetchEventsResult, String>

// Phase 6 additions:
pub async fn list_providers() -> Result<Vec<String>, String>
pub async fn get_provider_metadata(provider: String) -> Result<ProviderMetadataResult, String>
```

**Response types defined here:**
- `ConnectionResult { ok, principal, error }`
- `DiscoverResult { calendars: Vec<ProviderCalendar>, error }`
- `FetchEventsResult { events: Vec<ProviderEvent>, error }`
- `ProviderMetadataResult { metadata: ProviderMetadata }` (Phase 6)

### tauri.conf.json

| Setting | Value |
|---|---|
| identifier | `com.tasky.app` |
| Window | 1200x750, min 800x600, overlay title bar, hidden title |
| CSP | null (disabled) |
| SQL plugin preload | `sqlite:tasky.db` |
| Bundle targets | all (dmg, app, msi, etc.) |

### capabilities/default.json

Permissions: `core:default`, `core:window:default`, `core:window:allow-start-dragging`, `sql:default`, `sql:allow-execute`, `notification:default`

---

## Providers Crate (providers/)

**Crate:** `tasky-providers` (v0.0.1)

**Dependencies:** `serde`, `serde_json`, `tokio`, `libdav` (0.10), `icalendar` (0.17 with parser), `hyper` (1.x), `hyper-rustls`, `hyper-util`, `tower-service`, `tower-http` (auth), `http`, `chrono`, `uuid`, `reqwest` (for GitHub)

### lib.rs -- Core Types, Trait, and Dispatch (192 lines)

**Shared types:**

| Type | Purpose |
|---|---|
| `ProviderCalendar` | Discovered calendar/repo (`id`, `display_name`, `color`, `supports_sync`) |
| `ProviderTask` | Normalized task from any provider (15 fields including `remote_id`, `etag`, `href`) |
| `ProviderEvent` | Calendar event for display (`remote_id`, `calendar_id`, `title`, `start`, `end`, etc.) |
| `PushResult` | Result of pushing one task (`local_id`, `remote_id`, `etag`, `href`) |
| `SyncOutput` | Full sync result (`pushed`, `push_errors`, `delete_errors`, `remote_tasks`, `fetch_error`) |
| `TaskPushInput` | Task to push (16 fields) |
| `TaskDeleteInput` | Task to delete (`href`, `etag`) |

**Trait:**

```rust
pub trait SyncProvider {
    fn provider_id() -> &'static str;
    fn metadata() -> ProviderMetadata;   // Phase 6: credential + map field definitions
    async fn test_connection(config: &Value) -> Result<bool, String>;
    async fn discover_calendars(config: &Value) -> Result<Vec<ProviderCalendar>, String>;
    async fn sync(config: &Value, calendar_id: &str,
        pending: Vec<TaskPushInput>, deleted: Vec<TaskDeleteInput>
    ) -> Result<SyncOutput, String>;
    async fn fetch_events(config: &Value, calendar_id: &str,
        range_start: &str, range_end: &str
    ) -> Result<Vec<ProviderEvent>, String>;
}
```

**Phase 6 metadata types (providers/src/lib.rs):**

```rust
pub struct ProviderFieldDef {
    pub key: String,         // snake_case key in credentials JSON
    pub label: String,       // display label
    pub field_type: String,  // "text" | "password" | "url"
    pub required: bool,
}

pub struct ProviderMapFieldDef {
    pub key: String,         // key in settings JSON
    pub label: String,
    pub field_type: String,  // "checkbox" | "text"
    pub default_value: Option<serde_json::Value>,
}

pub struct ProviderMetadata {
    pub id: String,
    pub display_name: String,
    pub icon: String,        // Lucide icon name: "wifi" (CalDAV), "github" (GitHub)
    pub credential_fields: Vec<ProviderFieldDef>,
    pub map_fields: Vec<ProviderMapFieldDef>,
}
```

**Dispatch module:** Routes string provider IDs to implementations:
- `"caldav"` -> `CalDavProvider`
- `"github"` -> `GitHubProvider`
- Other -> `Err("unknown provider: ...")`

Phase 6 additions to dispatch:
- `list_providers()` -- returns `vec!["caldav", "github"]`
- `provider_metadata(id)` -- returns `ProviderMetadata` for given id

---

### CalDAV Provider (caldav/)

#### mod.rs (387 lines)

**Config:** `CalDavConfig { server_url, username, password }` (deserialized from opaque `serde_json::Value`)

**HTTP stack:** `hyper` + `hyper-rustls` (HTTPS) + `tower-http::AddAuthorization` (Basic auth) + `libdav::CalDavClient`

**`test_connection`:** Builds client, calls `find_current_user_principal()`.

**`discover_calendars`:**
1. Find current user principal (fallback to base URL)
2. Discover calendar home sets via `FindCalendarHomeSet`
3. Find calendars via `FindCalendars`
4. Return `Vec<ProviderCalendar>` with href as id

**`sync` (3-phase):**
1. **Fetch:** List VTODO resources via `ListCalendarResources` (filtered to VTODO), fetch full data via `GetCalendarResources`, parse iCal via `parse_vtodos`, build `uid_to_href` map
2. **Push:** For each pending task, generate UID if new, convert to VTodo, serialize to iCal, PUT to server with:
   - `If-Match: etag` for updates
   - `If-None-Match: *` for creates
   - Unconditional for UID conflicts with no local etag
   - Returns `PushResult` with new etag
3. **Delete:** Send `Delete` request per href (conditional on etag if available, forced otherwise)

**`fetch_events`:** List VEVENT resources, fetch full data, parse via `parse_vevents`.

#### ical.rs (256 lines)

**Types:**
- `VTodo` -- `uid`, `summary`, `description`, `due`, `priority`, `categories`, `status`, `completed`, `completed_at`, `rrule`, `related_to`, `notes`, `time_estimate`, `source_event_uid`
- `VEvent` -- `uid`, `summary`, `description`, `dtstart`, `dtend`, `location`, `color`

**Functions:**

| Function | Purpose |
|---|---|
| `parse_vtodos(ical_text) -> Vec<VTodo>` | Parse iCal text, extract VTODO components |
| `vtodo_to_ical(vtodo) -> String` | Serialize VTodo to full iCalendar string |
| `parse_vevents(ical_text) -> Vec<VEvent>` | Parse iCal text, extract VEVENT components |

**Custom X-properties preserved through CalDAV round-trips:**
- `X-TASKY-NOTES` -- task notes field
- `X-TASKY-TIME-ESTIMATE` -- time estimate in minutes
- `X-TASKY-SOURCE-EVENT-UID` -- links task to originating calendar event

**Date handling:** DUE field parsed as RFC 3339 datetime -> chrono UTC, date-only "YYYY-MM-DD" -> NaiveDate, raw string fallback. COMPLETED formatted as iCal UTC (`YYYYMMDDTHHMMSSZ`).

---

### GitHub Provider (github/)

#### mod.rs (489 lines)

**Config:** `GitHubConfig { token, query (default "assignee:@me is:open"), read_only (default false) }`

**HTTP:** `reqwest::Client` with Bearer auth, GitHub Accept/API-version headers

**`test_connection`:** `GET /user` with PAT.

**`discover_calendars` (repos):** Paginated `GET /user/repos?type=all&sort=updated&per_page=100`. Returns repos as `ProviderCalendar` where `id` = `full_name`.

**`sync` (3-phase, respects `read_only`):**
1. **Push** (skipped if read_only): PATCH existing issues or POST new ones
2. **Delete** (skipped if read_only): Closes issues (PATCH `{"state":"closed"}`) -- GitHub has no true delete
3. **Fetch:** `search_issues` with configured query (paginated Search API, auto-scopes with `repo:{name} is:issue`, filters out PRs, max 1000 results)

**`fetch_events`:** Always returns `Ok(vec![])` -- GitHub has no calendar concept.

**Mapping notes:**
- Repos -> calendars (id = full_name)
- Issues -> tasks (caldavUid = issue number, etag = updated_at)
- Labels -> tags
- Issue body -> description (with notes separated by `---`)
- No due_date, priority, rrule, parent, time_estimate, or source_event_uid (all None)

---

## IPC / Provider Bridge (src/providers/)

### Wire Types (providers/types.ts)

TypeScript types mirroring Rust structs. Priority uses RFC 5545 numeric mapping: 1=high, 5=medium, 9=low.

| Type | Purpose |
|---|---|
| `ProviderCalendar` | Discovered calendar/repo |
| `ProviderTask` | Remote task |
| `ProviderEvent` | Calendar event (VEVENT) |
| `PushResult` | Push result (localId, remoteId, etag, href) |
| `SyncOutput` | Full sync result |
| `TaskPushInput` | Task to push |
| `TaskDeleteInput` | Task to delete |
| `ProviderFieldDef` | Credential field definition (Phase 6) |
| `ProviderMapFieldDef` | Map settings field definition (Phase 6) |
| `ProviderMetadata` | Full provider metadata incl. icon + fields (Phase 6) |

### IPC Functions (providers/ipc.ts)

| Function | Tauri Command | Purpose |
|---|---|---|
| `providerTestConnection(providerId, config)` | `test_connection` | Test connectivity |
| `providerDiscoverCalendars(providerId, config)` | `discover_calendars` | List available calendars/repos |
| `providerSync(providerId, config, calendarId, pending, deleted)` | `sync_account` | Bidirectional sync |
| `providerFetchEvents(providerId, config, calendarId, rangeStart, rangeEnd)` | `fetch_events` | Fetch VEVENT data |
| `providerListProviders()` | `list_providers` | Returns `string[]` of provider IDs (Phase 6) |
| `providerGetMetadata(providerId)` | `get_provider_metadata` | Returns `ProviderMetadata` (Phase 6) |

All handle snake_case <-> camelCase conversion via private wire types and deserializers. The `providerId` string selects the Rust implementation.
