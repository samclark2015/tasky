use serde::{Deserialize, Serialize};
use tasky_providers::{ProviderCalendar, ProviderEvent, ProviderMetadata, SyncOutput, TaskDeleteInput, TaskPushInput};

#[derive(Debug, Serialize)]
pub struct ConnectionResult {
    pub ok: bool,
    pub principal: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscoverResult {
    pub calendars: Vec<ProviderCalendar>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FetchEventsResult {
    pub events: Vec<ProviderEvent>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_connection(
    provider: String,
    config: serde_json::Value,
) -> Result<ConnectionResult, String> {
    match tasky_providers::dispatch::test_connection(&provider, &config).await {
        Ok(_) => Ok(ConnectionResult { ok: true, principal: None, error: None }),
        Err(e) => Ok(ConnectionResult { ok: false, principal: None, error: Some(e) }),
    }
}

#[tauri::command]
pub async fn discover_calendars(
    provider: String,
    config: serde_json::Value,
) -> Result<DiscoverResult, String> {
    match tasky_providers::dispatch::discover_calendars(&provider, &config).await {
        Ok(calendars) => Ok(DiscoverResult { calendars, error: None }),
        Err(e) => Ok(DiscoverResult { calendars: vec![], error: Some(e) }),
    }
}

#[tauri::command]
pub async fn sync_account(
    provider: String,
    config: serde_json::Value,
    calendar_href: String,
    pending_tasks: Vec<TaskPushInput>,
    deleted_hrefs: Vec<TaskDeleteInput>,
) -> Result<SyncOutput, String> {
    tasky_providers::dispatch::sync(&provider, &config, &calendar_href, pending_tasks, deleted_hrefs)
        .await
}

#[tauri::command]
pub async fn fetch_events(
    provider: String,
    config: serde_json::Value,
    calendar_href: String,
    range_start: String,
    range_end: String,
) -> Result<FetchEventsResult, String> {
    match tasky_providers::dispatch::fetch_events(
        &provider,
        &config,
        &calendar_href,
        &range_start,
        &range_end,
    )
    .await
    {
        Ok(events) => Ok(FetchEventsResult { events, error: None }),
        Err(e) => Ok(FetchEventsResult { events: vec![], error: Some(e) }),
    }
}

#[tauri::command]
pub fn list_providers() -> Vec<ProviderMetadata> {
    tasky_providers::dispatch::list_providers()
}

#[tauri::command]
pub fn get_provider_metadata(provider: String) -> Result<ProviderMetadata, String> {
    tasky_providers::dispatch::provider_metadata(&provider)
}
