pub mod caldav;
pub mod github;

use serde::{Deserialize, Serialize};

/// Definition of a single credential field shown in the add-account form.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderFieldDef {
    /// Credential key stored in `provider_accounts.credentials` JSON
    pub key: String,
    pub label: String,
    /// "text" | "password" | "url"
    pub field_type: String,
    pub required: bool,
    pub placeholder: Option<String>,
    pub help_text: Option<String>,
}

/// Definition of a per-source (map-level) setting shown after linking a source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMapFieldDef {
    /// Setting key stored in `provider_maps.settings` JSON
    pub key: String,
    pub label: String,
    /// "text" | "boolean"
    pub field_type: String,
    pub default_value: Option<serde_json::Value>,
    pub help_text: Option<String>,
}

/// Static metadata about a provider — returned by `list_providers` / `get_provider_metadata`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    /// Stable identifier ("caldav", "github")
    pub id: String,
    pub display_name: String,
    /// Lucide icon name ("wifi", "github")
    pub icon: String,
    pub description: String,
    pub credential_fields: Vec<ProviderFieldDef>,
    pub map_fields: Vec<ProviderMapFieldDef>,
    /// Singular noun for a source ("calendar", "repository")
    pub source_noun: String,
    /// Plural noun for sources ("calendars", "repositories")
    pub source_noun_plural: String,
    pub supports_events: bool,
}

/// A remote calendar/source discovered from a provider account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCalendar {
    /// Stable identifier for this calendar within the provider (URL, path, ID…)
    pub id: String,
    pub display_name: Option<String>,
    pub color: Option<String>,
    /// Whether the source supports incremental sync tokens
    pub supports_sync: bool,
}

/// A task payload normalised from whatever remote format the provider uses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTask {
    /// Provider-assigned stable UID (e.g. CalDAV UID, GitHub issue number)
    pub remote_id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    /// 1=high 5=medium 9=low (RFC 5545 convention)
    pub priority: Option<u32>,
    pub tags: Vec<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub rrule: Option<String>,
    pub parent_remote_id: Option<String>,
    pub notes: Option<String>,
    pub time_estimate: Option<i64>,
    pub source_event_uid: Option<String>,
    /// Opaque cache-buster from the provider (ETag, updated_at timestamp…)
    pub etag: String,
    /// Full resource locator within the provider (href, URL, API path…)
    pub href: String,
}

/// A calendar event supplied by a provider (read for display; writable for VEVENT-backed tasks).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEvent {
    pub remote_id: String,
    pub calendar_id: String,
    pub title: String,
    pub description: Option<String>,
    pub start: Option<String>,
    pub end: Option<String>,
    pub location: Option<String>,
    pub color: Option<String>,
    /// Opaque cache-buster (ETag) from the server.
    pub etag: String,
    /// Full resource locator within the provider (href, URL, API path…)
    pub href: String,
}

/// Result of a push-to-remote operation for a single task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushResult {
    /// Local task ID (echoed back so the frontend can reconcile)
    pub local_id: String,
    pub remote_id: String,
    pub etag: String,
    pub href: String,
}

/// Everything a sync round-trip returns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOutput {
    pub pushed: Vec<PushResult>,
    pub push_errors: Vec<String>,
    pub delete_errors: Vec<String>,
    pub remote_tasks: Vec<ProviderTask>,
    pub fetch_error: Option<String>,
    /// Results of VEVENT push operations (for VEVENT-backed tasks).
    pub event_pushed: Vec<PushResult>,
    pub event_push_errors: Vec<String>,
    /// Latest state of watched VEVENTs (inbound change detection).
    pub remote_events: Vec<ProviderEvent>,
}

/// Input describing a VEVENT-backed task that needs to be pushed back to the calendar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPushInput {
    pub local_id: String,
    pub event_uid: String,
    pub title: String,
    pub description: Option<String>,
    pub dtstart: Option<String>,
    pub dtend: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub time_estimate: Option<i64>,
    pub completed: bool,
    pub priority: String,
    /// Current ETag of the VEVENT as stored locally.
    pub etag: Option<String>,
}

/// Input describing a local task that needs to be pushed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPushInput {
    pub local_id: String,
    pub remote_id: Option<String>,
    pub title: String,
    pub description: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub tags: Vec<String>,
    pub rrule: Option<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub notes: String,
    pub time_estimate: Option<i64>,
    pub etag: Option<String>,
    pub href: Option<String>,
    pub parent_remote_id: Option<String>,
    pub source_event_uid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDeleteInput {
    pub href: String,
    pub etag: Option<String>,
}

/// The trait every sync provider must implement.
///
/// All methods are async and take plain data — no Tauri state, no DB access.
/// Tauri commands in the app crate are thin wrappers that call these methods.
#[allow(async_fn_in_trait)]
pub trait SyncProvider {
    /// Stable identifier used as the Tauri command prefix ("caldav", "github"…)
    fn provider_id() -> &'static str;

    /// Static metadata describing this provider's credential schema and UI labels.
    fn metadata() -> ProviderMetadata;

    async fn test_connection(config: &serde_json::Value) -> Result<bool, String>;

    async fn discover_calendars(config: &serde_json::Value) -> Result<Vec<ProviderCalendar>, String>;

    async fn sync(
        config: &serde_json::Value,
        calendar_id: &str,
        pending: Vec<TaskPushInput>,
        deleted: Vec<TaskDeleteInput>,
        pending_events: Vec<EventPushInput>,
        event_uids_to_check: Vec<String>,
    ) -> Result<SyncOutput, String>;

    async fn fetch_events(
        config: &serde_json::Value,
        calendar_id: &str,
        range_start: &str,
        range_end: &str,
    ) -> Result<Vec<ProviderEvent>, String>;
}

/// Route provider operations to the correct implementation by string identifier.
///
/// This is the single location in the codebase that maps provider id strings
/// to concrete provider types. Callers pass an opaque `config` value whose
/// schema is defined by each provider.
pub mod dispatch {
    use super::*;

    pub async fn test_connection(
        provider: &str,
        config: &serde_json::Value,
    ) -> Result<bool, String> {
        match provider {
            "caldav" => caldav::CalDavProvider::test_connection(config).await,
            "github" => github::GitHubProvider::test_connection(config).await,
            _ => Err(format!("unknown provider: {provider}")),
        }
    }

    pub async fn discover_calendars(
        provider: &str,
        config: &serde_json::Value,
    ) -> Result<Vec<ProviderCalendar>, String> {
        match provider {
            "caldav" => caldav::CalDavProvider::discover_calendars(config).await,
            "github" => github::GitHubProvider::discover_calendars(config).await,
            _ => Err(format!("unknown provider: {provider}")),
        }
    }

    pub async fn sync(
        provider: &str,
        config: &serde_json::Value,
        calendar_id: &str,
        pending: Vec<TaskPushInput>,
        deleted: Vec<TaskDeleteInput>,
        pending_events: Vec<EventPushInput>,
        event_uids_to_check: Vec<String>,
    ) -> Result<SyncOutput, String> {
        match provider {
            "caldav" => caldav::CalDavProvider::sync(config, calendar_id, pending, deleted, pending_events, event_uids_to_check).await,
            "github" => github::GitHubProvider::sync(config, calendar_id, pending, deleted, pending_events, event_uids_to_check).await,
            _ => Err(format!("unknown provider: {provider}")),
        }
    }

    pub async fn fetch_events(
        provider: &str,
        config: &serde_json::Value,
        calendar_id: &str,
        range_start: &str,
        range_end: &str,
    ) -> Result<Vec<ProviderEvent>, String> {
        match provider {
            "caldav" => {
                caldav::CalDavProvider::fetch_events(config, calendar_id, range_start, range_end)
                    .await
            }
            "github" => {
                github::GitHubProvider::fetch_events(config, calendar_id, range_start, range_end)
                    .await
            }
            _ => Err(format!("unknown provider: {provider}")),
        }
    }

    /// Return metadata for all registered providers.
    pub fn list_providers() -> Vec<ProviderMetadata> {
        vec![
            caldav::CalDavProvider::metadata(),
            github::GitHubProvider::metadata(),
        ]
    }

    /// Return metadata for a specific provider by ID.
    pub fn provider_metadata(id: &str) -> Result<ProviderMetadata, String> {
        match id {
            "caldav" => Ok(caldav::CalDavProvider::metadata()),
            "github" => Ok(github::GitHubProvider::metadata()),
            _ => Err(format!("unknown provider: {id}")),
        }
    }
}
