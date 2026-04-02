use serde::{Deserialize, Serialize};
use tasky_providers::{
    caldav::CalDavProvider, ProviderCalendar, ProviderEvent, SyncOutput, SyncProvider,
    TaskDeleteInput, TaskPushInput,
};

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
pub async fn caldav_test_connection(
    server_url: String,
    username: String,
    password: String,
) -> Result<ConnectionResult, String> {
    let config =
        serde_json::json!({ "server_url": server_url, "username": username, "password": password });
    match CalDavProvider::test_connection(&config).await {
        Ok(_) => Ok(ConnectionResult { ok: true, principal: None, error: None }),
        Err(e) => Ok(ConnectionResult { ok: false, principal: None, error: Some(e) }),
    }
}

#[tauri::command]
pub async fn caldav_discover_calendars(
    server_url: String,
    username: String,
    password: String,
) -> Result<DiscoverResult, String> {
    let config =
        serde_json::json!({ "server_url": server_url, "username": username, "password": password });
    match CalDavProvider::discover_calendars(&config).await {
        Ok(calendars) => Ok(DiscoverResult { calendars, error: None }),
        Err(e) => Ok(DiscoverResult { calendars: vec![], error: Some(e) }),
    }
}

#[tauri::command]
pub async fn caldav_sync_account(
    server_url: String,
    username: String,
    password: String,
    calendar_href: String,
    pending_tasks: Vec<TaskPushInput>,
    deleted_hrefs: Vec<TaskDeleteInput>,
) -> Result<SyncOutput, String> {
    let config =
        serde_json::json!({ "server_url": server_url, "username": username, "password": password });
    CalDavProvider::sync(&config, &calendar_href, pending_tasks, deleted_hrefs).await
}

#[tauri::command]
pub async fn caldav_fetch_events(
    server_url: String,
    username: String,
    password: String,
    calendar_href: String,
    range_start: String,
    range_end: String,
) -> Result<FetchEventsResult, String> {
    let config =
        serde_json::json!({ "server_url": server_url, "username": username, "password": password });
    match CalDavProvider::fetch_events(&config, &calendar_href, &range_start, &range_end).await {
        Ok(events) => Ok(FetchEventsResult { events, error: None }),
        Err(e) => Ok(FetchEventsResult { events: vec![], error: Some(e) }),
    }
}
