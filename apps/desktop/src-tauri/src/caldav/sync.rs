use super::ical::{parse_vevents, parse_vtodos, vtodo_to_ical, VEvent, VTodo};
use http::Uri;
use hyper::body::Incoming;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::{client::legacy::Client, rt::TokioExecutor};
use libdav::{
    caldav::{CalDavClient, FindCalendarHomeSet, FindCalendars, GetCalendarResources, ListCalendarResources},
    dav::{Delete, PutResource, WebDavClient},
};
use serde::{Deserialize, Serialize};
use tower_http::auth::AddAuthorization;
use tower_service::Service;

type HyperConnector = HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>;
type AuthClient = AddAuthorization<Client<HyperConnector, String>>;
type TaskyCalDavClient = CalDavClient<AuthClient>;

fn make_client(
    server_url: &str,
    username: &str,
    password: &str,
) -> Result<TaskyCalDavClient, String> {
    let connector = HttpsConnectorBuilder::new()
        .with_native_roots()
        .map_err(|e| format!("TLS roots error: {e}"))?
        .https_or_http()
        .enable_http1()
        .enable_http2()
        .build();

    let http_client = Client::builder(TokioExecutor::new()).build(connector);
    let auth_client = AddAuthorization::basic(http_client, username, password);

    let uri: Uri = server_url
        .parse()
        .map_err(|e| format!("Invalid server URL: {e}"))?;

    let webdav = WebDavClient::new(uri, auth_client);
    Ok(CalDavClient::new(webdav))
}

fn _assert_service<S: Service<http::Request<String>, Response = http::Response<Incoming>>>(_: &S) {}


// ── Types exposed to the frontend ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionResult {
    pub ok: bool,
    pub principal: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteEvent {
    pub href: String,
    pub etag: String,
    pub vevent: VEvent,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchEventsResult {
    pub events: Vec<RemoteEvent>,
    pub error: Option<String>,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarInfo {
    pub href: String,
    pub display_name: Option<String>,
    pub color: Option<String>,
    pub supports_sync: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscoverResult {
    pub calendars: Vec<CalendarInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncTaskInput {
    pub id: String,
    pub list_id: Option<String>,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub tags: Vec<String>,
    pub recurrence_rrule: Option<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub notes: String,
    pub time_estimate: Option<i64>,
    pub etag: Option<String>,
    pub caldav_uid: Option<String>,
    pub sync_status: String,
    pub updated_at: String,
    pub source_event_uid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncTaskResult {
    pub id: String,
    pub caldav_uid: String,
    pub etag: String,
    pub href: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteTask {
    pub href: String,
    pub etag: String,
    pub vtodo: VTodo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchRemoteResult {
    pub tasks: Vec<RemoteTask>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteTaskInput {
    pub href: String,
    pub etag: Option<String>,
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn caldav_test_connection(
    server_url: String,
    username: String,
    password: String,
) -> Result<ConnectionResult, String> {
    let client = match make_client(&server_url, &username, &password) {
        Ok(c) => c,
        Err(e) => return Ok(ConnectionResult { ok: false, principal: None, error: Some(e) }),
    };

    match client.find_current_user_principal().await {
        Ok(Some(uri)) => Ok(ConnectionResult {
            ok: true,
            principal: Some(uri.to_string()),
            error: None,
        }),
        Ok(None) => Ok(ConnectionResult {
            ok: true,
            principal: None,
            error: None,
        }),
        Err(e) => Ok(ConnectionResult {
            ok: false,
            principal: None,
            error: Some(format!("{e}")),
        }),
    }
}

#[tauri::command]
pub async fn caldav_discover_calendars(
    server_url: String,
    username: String,
    password: String,
) -> Result<DiscoverResult, String> {
    let client = match make_client(&server_url, &username, &password) {
        Ok(c) => c,
        Err(e) => return Ok(DiscoverResult { calendars: vec![], error: Some(e) }),
    };

    let principal = match client.find_current_user_principal().await {
        Ok(Some(p)) => p,
        Ok(None) => {
            // Fall back to server root
            client.base_url().clone()
        }
        Err(e) => return Ok(DiscoverResult {
            calendars: vec![],
            error: Some(format!("Could not find principal: {e}")),
        }),
    };

    let home_sets = match client.request(FindCalendarHomeSet::new(&principal)).await {
        Ok(resp) => resp.home_sets,
        Err(e) => return Ok(DiscoverResult {
            calendars: vec![],
            error: Some(format!("Could not find calendar home set: {e}")),
        }),
    };

    let mut calendars = Vec::new();
    for home_set in &home_sets {
        match client.request(FindCalendars::new(home_set)).await {
            Ok(resp) => {
                for cal in resp.calendars {
                    // Only include calendars that support VTODO (checked below)
                    // For now include all discovered calendars
                    calendars.push(CalendarInfo {
                        href: cal.href.clone(),
                        display_name: None,
                        color: None,
                        supports_sync: cal.supports_sync,
                    });
                }
            }
            Err(e) => {
                eprintln!("[caldav] Error finding calendars in {home_set}: {e}");
            }
        }
    }

    Ok(DiscoverResult { calendars, error: None })
}

#[tauri::command]
pub async fn caldav_sync_account(
    server_url: String,
    username: String,
    password: String,
    calendar_href: String,
    pending_tasks: Vec<SyncTaskInput>,
    deleted_hrefs: Vec<DeleteTaskInput>,
) -> Result<serde_json::Value, String> {
    let client = match make_client(&server_url, &username, &password) {
        Ok(c) => c,
        Err(e) => return Err(e),
    };

    let mut pushed: Vec<SyncTaskResult> = Vec::new();
    let mut push_errors: Vec<String> = Vec::new();

    // Push pending local tasks to remote
    for task in &pending_tasks {
        let uid = task
            .caldav_uid
            .clone()
            .unwrap_or_else(|| format!("{}@tasky", uuid::Uuid::new_v4()));

        let vtodo = VTodo {
            uid: uid.clone(),
            summary: task.title.clone(),
            description: if task.description.is_empty() {
                None
            } else {
                Some(task.description.clone())
            },
            due: task.due_date.clone(),
            priority: Some(priority_str_to_num(&task.priority)),
            categories: task.tags.clone(),
            status: None,
            completed: task.completed,
            completed_at: task.completed_at.clone(),
            rrule: task.recurrence_rrule.clone(),
            related_to: task.parent_id.clone(),
            notes: if task.notes.is_empty() {
                None
            } else {
                Some(task.notes.clone())
            },
            time_estimate: task.time_estimate,
            source_event_uid: task.source_event_uid.clone(),
        };

        let ical_data = vtodo_to_ical(&vtodo);
        let resource_href = format!(
            "{}/{}.ics",
            calendar_href.trim_end_matches('/'),
            uid
        );

        let put_result = if let Some(etag) = &task.etag {
            client.request(
                PutResource::new(&resource_href)
                    .update(ical_data.clone(), "text/calendar", etag)
            ).await
        } else {
            client.request(
                PutResource::new(&resource_href)
                    .create(ical_data.clone(), "text/calendar")
            ).await
        };

        match put_result {
            Ok(resp) => {
                pushed.push(SyncTaskResult {
                    id: task.id.clone(),
                    caldav_uid: uid,
                    etag: resp.etag.unwrap_or_default(),
                    href: resource_href,
                });
            }
            Err(e) => {
                push_errors.push(format!("Task {}: {e}", task.id));
            }
        }
    }

    // Delete removed tasks from remote
    let mut delete_errors: Vec<String> = Vec::new();
    for d in &deleted_hrefs {
        let result = if let Some(etag) = &d.etag {
            client.request(Delete::new(&d.href).with_etag(etag)).await
        } else {
            client.request(Delete::new(&d.href).force()).await
        };
        if let Err(e) = result {
            delete_errors.push(format!("{}: {e}", d.href));
        }
    }

    // Fetch all remote tasks for this calendar
    let list_req = match ListCalendarResources::new(&calendar_href).with_component("VTODO") {
        Ok(r) => r,
        Err(e) => {
            return Ok(serde_json::json!({
                "pushed": pushed,
                "push_errors": push_errors,
                "delete_errors": delete_errors,
                "remote_tasks": [],
                "fetch_error": format!("Invalid component: {e}"),
            }));
        }
    };
    let resource_list = match client.request(list_req).await {
        Ok(r) => r,
        Err(e) => {
            return Ok(serde_json::json!({
                "pushed": pushed,
                "push_errors": push_errors,
                "delete_errors": delete_errors,
                "remote_tasks": [],
                "fetch_error": format!("{e}"),
            }));
        }
    };

    let hrefs: Vec<String> = resource_list
        .resources
        .iter()
        .map(|r| r.href.clone())
        .collect();

    let mut remote_tasks: Vec<RemoteTask> = Vec::new();
    if !hrefs.is_empty() {
        match client
            .request(
                GetCalendarResources::new(&calendar_href)
                    .with_hrefs(hrefs.iter().map(|s| s.as_str())),
            )
            .await
        {
            Ok(resp) => {
                for resource in resp.resources {
                    if let Ok(content) = resource.content {
                        let vtodos = parse_vtodos(&content.data);
                        for vtodo in vtodos {
                            remote_tasks.push(RemoteTask {
                                href: resource.href.clone(),
                                etag: content.etag.clone(),
                                vtodo,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                push_errors.push(format!("Fetch remote error: {e}"));
            }
        }
    }

    Ok(serde_json::json!({
        "pushed": pushed,
        "push_errors": push_errors,
        "delete_errors": delete_errors,
        "remote_tasks": remote_tasks,
    }))
}

#[tauri::command]
pub async fn caldav_fetch_events(
    server_url: String,
    username: String,
    password: String,
    calendar_href: String,
    _range_start: String,
    _range_end: String,
) -> Result<FetchEventsResult, String> {
    let client = match make_client(&server_url, &username, &password) {
        Ok(c) => c,
        Err(e) => return Ok(FetchEventsResult { events: vec![], error: Some(e) }),
    };

    // Fetch calendar events (VEVENT) for the specified date range
    let list_req = match ListCalendarResources::new(&calendar_href).with_component("VEVENT") {
        Ok(r) => r,
        Err(e) => {
            return Ok(FetchEventsResult {
                events: vec![],
                error: Some(format!("Invalid component: {e}")),
            });
        }
    };

    let resource_list = match client.request(list_req).await {
        Ok(r) => r,
        Err(e) => {
            return Ok(FetchEventsResult {
                events: vec![],
                error: Some(format!("Failed to list events: {e}")),
            });
        }
    };

    let hrefs: Vec<String> = resource_list
        .resources
        .iter()
        .map(|r| r.href.clone())
        .collect();

    let mut remote_events: Vec<RemoteEvent> = Vec::new();
    if !hrefs.is_empty() {
        match client
            .request(
                GetCalendarResources::new(&calendar_href)
                    .with_hrefs(hrefs.iter().map(|s| s.as_str())),
            )
            .await
        {
            Ok(resp) => {
                for resource in resp.resources {
                    if let Ok(content) = resource.content {
                        let vevents = parse_vevents(&content.data);
                        for vevent in vevents {
                            // Filter events by date range if needed
                            // For now, include all events
                            remote_events.push(RemoteEvent {
                                href: resource.href.clone(),
                                etag: content.etag.clone(),
                                vevent,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                return Ok(FetchEventsResult {
                    events: vec![],
                    error: Some(format!("Failed to fetch event data: {e}")),
                });
            }
        }
    }

    Ok(FetchEventsResult {
        events: remote_events,
        error: None,
    })
}

fn priority_str_to_num(p: &str) -> u32 {
    match p {
        "high" => 1,
        "medium" => 5,
        "low" => 9,
        _ => 5,
    }
}
