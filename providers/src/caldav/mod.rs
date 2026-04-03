mod ical;

use ical::{parse_vevents, parse_vtodos, vevent_to_ical, vtodo_to_ical, VTodo};
use http::{Method, Uri};
use hyper::body::Incoming;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::{client::legacy::Client, rt::TokioExecutor};
use libdav::{
    caldav::{CalDavClient, FindCalendarHomeSet, FindCalendars, GetCalendarResources, ListCalendarResources},
    dav::{Delete, WebDavClient},
};
use serde::Deserialize;
use tower_http::auth::AddAuthorization;
use tower_service::Service;

use crate::{
    EventPushInput, ProviderCalendar, ProviderEvent, ProviderFieldDef, ProviderMapFieldDef, ProviderMetadata,
    ProviderTask, PushResult, SyncOutput, SyncProvider, TaskDeleteInput, TaskPushInput,
};

// ── Internal HTTP client ──────────────────────────────────────────────────────

type HyperConnector = HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>;
type AuthClient = AddAuthorization<Client<HyperConnector, String>>;
type TaskyCalDavClient = CalDavClient<AuthClient>;

fn _assert_service<S: Service<http::Request<String>, Response = http::Response<Incoming>>>(_: &S) {}

fn make_client(server_url: &str, username: &str, password: &str) -> Result<TaskyCalDavClient, String> {
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

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CalDavConfig {
    server_url: String,
    username: String,
    password: String,
}

impl CalDavConfig {
    fn from_value(v: &serde_json::Value) -> Result<Self, String> {
        serde_json::from_value(v.clone()).map_err(|e| format!("Invalid CalDAV config: {e}"))
    }
}

// ── SyncProvider implementation ───────────────────────────────────────────────

pub struct CalDavProvider;

impl SyncProvider for CalDavProvider {
    fn provider_id() -> &'static str {
        "caldav"
    }

    fn metadata() -> ProviderMetadata {
        ProviderMetadata {
            id: "caldav".to_string(),
            display_name: "CalDAV".to_string(),
            icon: "wifi".to_string(),
            description: "Sync tasks with any CalDAV-compatible server (Nextcloud, Fastmail, iCloud, etc.)".to_string(),
            credential_fields: vec![
                ProviderFieldDef {
                    key: "server_url".to_string(),
                    label: "Server URL".to_string(),
                    field_type: "url".to_string(),
                    required: true,
                    placeholder: Some("https://dav.example.com".to_string()),
                    help_text: Some("The base URL of your CalDAV server".to_string()),
                },
                ProviderFieldDef {
                    key: "username".to_string(),
                    label: "Username".to_string(),
                    field_type: "text".to_string(),
                    required: true,
                    placeholder: Some("your@email.com".to_string()),
                    help_text: None,
                },
                ProviderFieldDef {
                    key: "password".to_string(),
                    label: "Password".to_string(),
                    field_type: "password".to_string(),
                    required: true,
                    placeholder: None,
                    help_text: Some("App-specific password recommended".to_string()),
                },
            ],
            map_fields: vec![
                ProviderMapFieldDef {
                    key: "events_only".to_string(),
                    label: "Events only (no tasks)".to_string(),
                    field_type: "boolean".to_string(),
                    default_value: Some(serde_json::Value::Bool(false)),
                    help_text: Some("Only fetch calendar events, do not sync tasks".to_string()),
                },
            ],
            source_noun: "calendar".to_string(),
            source_noun_plural: "calendars".to_string(),
            supports_events: true,
        }
    }

    async fn test_connection(config: &serde_json::Value) -> Result<bool, String> {
        let cfg = CalDavConfig::from_value(config)?;
        let client = make_client(&cfg.server_url, &cfg.username, &cfg.password)?;
        match client.find_current_user_principal().await {
            Ok(_) => Ok(true),
            Err(e) => Err(format!("{e}")),
        }
    }

    async fn discover_calendars(config: &serde_json::Value) -> Result<Vec<ProviderCalendar>, String> {
        let cfg = CalDavConfig::from_value(config)?;
        let client = make_client(&cfg.server_url, &cfg.username, &cfg.password)?;

        let principal = match client.find_current_user_principal().await {
            Ok(Some(p)) => p,
            Ok(None) => client.base_url().clone(),
            Err(e) => return Err(format!("Could not find principal: {e}")),
        };

        let home_sets = client
            .request(FindCalendarHomeSet::new(&principal))
            .await
            .map_err(|e| format!("Could not find calendar home set: {e}"))?
            .home_sets;

        let mut calendars = Vec::new();
        for home_set in &home_sets {
            match client.request(FindCalendars::new(home_set)).await {
                Ok(resp) => {
                    for cal in resp.calendars {
                        calendars.push(ProviderCalendar {
                            id: cal.href.clone(),
                            display_name: None,
                            color: None,
                            supports_sync: cal.supports_sync,
                        });
                    }
                }
                Err(e) => eprintln!("[caldav] Error finding calendars in {home_set}: {e}"),
            }
        }
        Ok(calendars)
    }

    async fn sync(
        config: &serde_json::Value,
        calendar_id: &str,
        pending: Vec<TaskPushInput>,
        deleted: Vec<TaskDeleteInput>,
        pending_events: Vec<EventPushInput>,
        event_uids_to_check: Vec<String>,
    ) -> Result<SyncOutput, String> {
        let cfg = CalDavConfig::from_value(config)?;
        let client = make_client(&cfg.server_url, &cfg.username, &cfg.password)?;

        let mut pushed: Vec<PushResult> = Vec::new();
        let mut push_errors: Vec<String> = Vec::new();
        let mut fetch_error: Option<String> = None;

        // ── 1. Fetch current server state ──────────────────────────────────────
        // Pull the full VTODO list *before* pushing so we can resolve the correct
        // href for every UID.  Without this, tasks whose .ics filename on the
        // server doesn't match their UID (created by another client, or moved by
        // Nextcloud) would fail with 412 / 400 on every sync.
        let mut remote_tasks: Vec<ProviderTask> = Vec::new();
        let mut uid_to_href: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();

        let fetch_hrefs: Vec<String> =
            match ListCalendarResources::new(calendar_id).with_component("VTODO") {
                Err(e) => {
                    fetch_error = Some(format!("Invalid component: {e}"));
                    vec![]
                }
                Ok(req) => match client.request(req).await {
                    Err(e) => {
                        fetch_error = Some(format!("{e}"));
                        vec![]
                    }
                    Ok(r) => r.resources.iter().map(|res| res.href.clone()).collect(),
                },
            };

        if !fetch_hrefs.is_empty() {
            match client
                .request(
                    GetCalendarResources::new(calendar_id)
                        .with_hrefs(fetch_hrefs.iter().map(|s| s.as_str())),
                )
                .await
            {
                Err(e) => {
                    if fetch_error.is_none() {
                        fetch_error = Some(format!("{e}"));
                    }
                }
                Ok(resp) => {
                    for resource in resp.resources {
                        if let Ok(content) = resource.content {
                            for vtodo in parse_vtodos(&content.data) {
                                uid_to_href.insert(vtodo.uid.clone(), resource.href.clone());
                                remote_tasks.push(ProviderTask {
                                    remote_id: vtodo.uid,
                                    title: vtodo.summary,
                                    description: vtodo.description,
                                    due_date: vtodo.due,
                                    priority: vtodo.priority,
                                    tags: vtodo.categories,
                                    completed: vtodo.completed,
                                    completed_at: vtodo.completed_at,
                                    rrule: vtodo.rrule,
                                    parent_remote_id: vtodo.related_to,
                                    notes: vtodo.notes,
                                    time_estimate: vtodo.time_estimate,
                                    source_event_uid: vtodo.source_event_uid,
                                    etag: content.etag.clone(),
                                    href: resource.href.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }

        // ── 2. Push pending tasks ──────────────────────────────────────────────
        for task in &pending {
            let uid = task
                .remote_id
                .clone()
                .unwrap_or_else(|| format!("{}@tasky", uuid::Uuid::new_v4()));

            let vtodo = VTodo {
                uid: uid.clone(),
                summary: task.title.clone(),
                description: if task.description.is_empty() { None } else { Some(task.description.clone()) },
                due: task.due_date.clone(),
                priority: Some(priority_str_to_num(&task.priority)),
                categories: task.tags.clone(),
                status: None,
                completed: task.completed,
                completed_at: task.completed_at.clone(),
                rrule: task.rrule.clone(),
                related_to: task.parent_remote_id.clone(),
                notes: if task.notes.is_empty() { None } else { Some(task.notes.clone()) },
                time_estimate: task.time_estimate,
                source_event_uid: task.source_event_uid.clone(),
            };

            let ical_data = vtodo_to_ical(&vtodo);

            // Use the server's known href when available.  This handles resources
            // whose filename on the server doesn't match the UID (e.g. created by
            // another client, or reorganised by Nextcloud).
            let uid_on_server = uid_to_href.contains_key(&uid);
            let resource_href = uid_to_href
                .get(&uid)
                .cloned()
                .unwrap_or_else(|| format!("{}/{}.ics", calendar_id.trim_end_matches('/'), uid));

            let op = match (&task.etag, uid_on_server) {
                (Some(_), true)  => "update",
                (Some(_), false) => "re-create", // had etag but server no longer has it
                _                => "create",
            };

            let uri = match client.relative_uri(&resource_href) {
                Ok(u) => u,
                Err(e) => {
                    push_errors.push(format!(
                        "Task {} (\"{}\") invalid PUT href {}: {e}",
                        task.local_id, task.title, resource_href
                    ));
                    continue;
                }
            };

            let request = {
                let mut builder = http::Request::builder()
                    .method(Method::PUT)
                    .uri(uri)
                    .header("Content-Type", "text/calendar");
                match (&task.etag, uid_on_server) {
                    // Normal update — server still has the resource.
                    (Some(etag), true) => builder = builder.header("If-Match", etag),
                    // Resource was previously synced but is gone from the server,
                    // OR this is a brand-new task.  Either way, create it fresh.
                    (Some(_), false) | (None, false) => {
                        builder = builder.header("If-None-Match", "*")
                    }
                    // UID exists on server but we have no local etag — data
                    // inconsistency; do an unconditional overwrite.
                    (None, true) => {}
                }
                match builder.body(ical_data) {
                    Ok(r) => r,
                    Err(e) => {
                        push_errors.push(format!(
                            "Task {} (\"{}\") failed to build PUT request: {e}",
                            task.local_id, task.title
                        ));
                        continue;
                    }
                }
            };

            match client.request_raw(request).await {
                Ok((parts, _body)) if parts.status.is_success() => {
                    let new_etag = parts
                        .headers
                        .get("etag")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or_default()
                        .to_string();
                    pushed.push(PushResult {
                        local_id: task.local_id.clone(),
                        remote_id: uid,
                        etag: new_etag,
                        href: resource_href,
                    });
                }
                Ok((parts, body)) => {
                    let body_text = String::from_utf8_lossy(&body);
                    push_errors.push(format!(
                        "Task {} (\"{}\") {} PUT {} → {}{}",
                        task.local_id,
                        task.title,
                        op,
                        resource_href,
                        parts.status,
                        if body_text.trim().is_empty() {
                            String::new()
                        } else {
                            format!(": {}", body_text.trim())
                        }
                    ));
                }
                Err(e) => push_errors.push(format!(
                    "Task {} (\"{}\") {} PUT {}: {e}",
                    task.local_id, task.title, op, resource_href
                )),
            }
        }

        // ── 3. Deletions ───────────────────────────────────────────────────────
        let mut delete_errors: Vec<String> = Vec::new();
        for d in &deleted {
            let result = if let Some(etag) = &d.etag {
                client.request(Delete::new(&d.href).with_etag(etag)).await
            } else {
                client.request(Delete::new(&d.href).force()).await
            };
            if let Err(e) = result {
                delete_errors.push(format!("{}: {e}", d.href));
            }
        }

        // ── 4. Push VEVENT-backed tasks ────────────────────────────────────────
        let mut event_pushed: Vec<PushResult> = Vec::new();
        let mut event_push_errors: Vec<String> = Vec::new();
        let mut remote_events: Vec<ProviderEvent> = Vec::new();

        if !pending_events.is_empty() || !event_uids_to_check.is_empty() {
            // List all VEVENT hrefs to build uid → href map.
            let vevent_hrefs: Vec<String> =
                match ListCalendarResources::new(calendar_id).with_component("VEVENT") {
                    Err(_) => vec![],
                    Ok(req) => match client.request(req).await {
                        Err(_) => vec![],
                        Ok(r) => r.resources.iter().map(|res| res.href.clone()).collect(),
                    },
                };

            // Determine which hrefs we need to actually fetch.
            // We batch-fetch pending_event UIDs + watched UIDs, deduplicated.
            let needed_uids: std::collections::HashSet<&str> = pending_events
                .iter()
                .map(|e| e.event_uid.as_str())
                .chain(event_uids_to_check.iter().map(|s| s.as_str()))
                .collect();

            // Fetch all VEVENT content so we can build uid → {href, ical, etag}.
            // (We fetch all because we cannot map uid → href without content.)
            struct VEventResource {
                href: String,
                etag: String,
                ical: String,
                uid: String,
            }
            let mut uid_to_vevent: std::collections::HashMap<String, VEventResource> =
                std::collections::HashMap::new();

            if !vevent_hrefs.is_empty() && !needed_uids.is_empty() {
                if let Ok(resp) = client
                    .request(
                        GetCalendarResources::new(calendar_id)
                            .with_hrefs(vevent_hrefs.iter().map(|s| s.as_str())),
                    )
                    .await
                {
                    for resource in resp.resources {
                        if let Ok(content) = resource.content {
                            for vevent in parse_vevents(&content.data) {
                                if needed_uids.contains(vevent.uid.as_str()) {
                                    uid_to_vevent.insert(
                                        vevent.uid.clone(),
                                        VEventResource {
                                            href: resource.href.clone(),
                                            etag: content.etag.clone(),
                                            ical: content.data.clone(),
                                            uid: vevent.uid,
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // Push each pending VEVENT update.
            for event in &pending_events {
                let (resource_href, existing_ical, server_etag) =
                    if let Some(res) = uid_to_vevent.get(&event.event_uid) {
                        (res.href.clone(), res.ical.clone(), Some(res.etag.clone()))
                    } else {
                        // Fallback href in case the event isn't on server yet.
                        let href = format!(
                            "{}/{}.ics",
                            calendar_id.trim_end_matches('/'),
                            event.event_uid
                        );
                        (href, String::new(), None)
                    };

                let ical_data = vevent_to_ical(&existing_ical, event);

                let uri = match client.relative_uri(&resource_href) {
                    Ok(u) => u,
                    Err(e) => {
                        event_push_errors.push(format!(
                            "Event {} (\"{}\") invalid href {}: {e}",
                            event.local_id, event.title, resource_href
                        ));
                        continue;
                    }
                };

                let request = {
                    let mut builder = http::Request::builder()
                        .method(Method::PUT)
                        .uri(uri)
                        .header("Content-Type", "text/calendar");
                    if let Some(etag) = &server_etag {
                        builder = builder.header("If-Match", etag);
                    }
                    match builder.body(ical_data) {
                        Ok(r) => r,
                        Err(e) => {
                            event_push_errors.push(format!(
                                "Event {} (\"{}\") failed to build PUT request: {e}",
                                event.local_id, event.title
                            ));
                            continue;
                        }
                    }
                };

                match client.request_raw(request).await {
                    Ok((parts, _body)) if parts.status.is_success() => {
                        let new_etag = parts
                            .headers
                            .get("etag")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default()
                            .to_string();
                        event_pushed.push(PushResult {
                            local_id: event.local_id.clone(),
                            remote_id: event.event_uid.clone(),
                            etag: new_etag,
                            href: resource_href,
                        });
                    }
                    Ok((parts, body)) => {
                        let body_text = String::from_utf8_lossy(&body);
                        event_push_errors.push(format!(
                            "Event {} (\"{}\") PUT {} → {}{}",
                            event.local_id,
                            event.title,
                            resource_href,
                            parts.status,
                            if body_text.trim().is_empty() {
                                String::new()
                            } else {
                                format!(": {}", body_text.trim())
                            }
                        ));
                    }
                    Err(e) => event_push_errors.push(format!(
                        "Event {} (\"{}\") PUT {}: {e}",
                        event.local_id, event.title, resource_href
                    )),
                }
            }

            // ── 5. Return latest state of watched VEVENTs ──────────────────────
            for uid in &event_uids_to_check {
                if let Some(res) = uid_to_vevent.get(uid) {
                    for vevent in parse_vevents(&res.ical) {
                        remote_events.push(ProviderEvent {
                            remote_id: vevent.uid,
                            calendar_id: calendar_id.to_string(),
                            title: vevent.summary,
                            description: vevent.description,
                            start: vevent.dtstart,
                            end: vevent.dtend,
                            location: vevent.location,
                            color: vevent.color,
                            etag: res.etag.clone(),
                            href: res.href.clone(),
                        });
                    }
                }
            }
        }

        Ok(SyncOutput {
            pushed,
            push_errors,
            delete_errors,
            remote_tasks,
            fetch_error,
            event_pushed,
            event_push_errors,
            remote_events,
        })
    }

    async fn fetch_events(
        config: &serde_json::Value,
        calendar_id: &str,
        _range_start: &str,
        _range_end: &str,
    ) -> Result<Vec<ProviderEvent>, String> {
        let cfg = CalDavConfig::from_value(config)?;
        let client = make_client(&cfg.server_url, &cfg.username, &cfg.password)?;

        let list_req = ListCalendarResources::new(calendar_id)
            .with_component("VEVENT")
            .map_err(|e| format!("Invalid component: {e}"))?;

        let resource_list = client
            .request(list_req)
            .await
            .map_err(|e| format!("Failed to list events: {e}"))?;

        let hrefs: Vec<String> = resource_list.resources.iter().map(|r| r.href.clone()).collect();
        let mut events: Vec<ProviderEvent> = Vec::new();

        if !hrefs.is_empty() {
            let resp = client
                .request(GetCalendarResources::new(calendar_id).with_hrefs(hrefs.iter().map(|s| s.as_str())))
                .await
                .map_err(|e| format!("Failed to fetch event data: {e}"))?;

            for resource in resp.resources {
                if let Ok(content) = resource.content {
                    for vevent in parse_vevents(&content.data) {
                        events.push(ProviderEvent {
                            remote_id: vevent.uid,
                            calendar_id: calendar_id.to_string(),
                            title: vevent.summary,
                            description: vevent.description,
                            start: vevent.dtstart,
                            end: vevent.dtend,
                            location: vevent.location,
                            color: vevent.color,
                            etag: content.etag.clone(),
                            href: resource.href.clone(),
                        });
                    }
                }
            }
        }

        Ok(events)
    }
}

fn priority_str_to_num(p: &str) -> u32 {
    match p {
        "high" => 1,
        "medium" => 5,
        "low" => 9,
        _ => 5,
    }
}
