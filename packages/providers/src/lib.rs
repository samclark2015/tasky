pub mod caldav;

use serde::{Deserialize, Serialize};

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

/// A calendar event (read-only) supplied by a provider for display purposes.
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

    async fn test_connection(config: &serde_json::Value) -> Result<bool, String>;

    async fn discover_calendars(config: &serde_json::Value) -> Result<Vec<ProviderCalendar>, String>;

    async fn sync(
        config: &serde_json::Value,
        calendar_id: &str,
        pending: Vec<TaskPushInput>,
        deleted: Vec<TaskDeleteInput>,
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
            _ => Err(format!("unknown provider: {provider}")),
        }
    }

    pub async fn discover_calendars(
        provider: &str,
        config: &serde_json::Value,
    ) -> Result<Vec<ProviderCalendar>, String> {
        match provider {
            "caldav" => caldav::CalDavProvider::discover_calendars(config).await,
            _ => Err(format!("unknown provider: {provider}")),
        }
    }

    pub async fn sync(
        provider: &str,
        config: &serde_json::Value,
        calendar_id: &str,
        pending: Vec<TaskPushInput>,
        deleted: Vec<TaskDeleteInput>,
    ) -> Result<SyncOutput, String> {
        match provider {
            "caldav" => caldav::CalDavProvider::sync(config, calendar_id, pending, deleted).await,
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
            _ => Err(format!("unknown provider: {provider}")),
        }
    }
}
