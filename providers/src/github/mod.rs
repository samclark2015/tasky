use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::{
    ProviderCalendar, ProviderEvent, ProviderTask, PushResult, SyncOutput, SyncProvider,
    TaskDeleteInput, TaskPushInput,
};

const GITHUB_API_BASE: &str = "https://api.github.com";

// ── Config ────────────────────────────────────────────────────────────────────

fn default_query() -> String {
    "assignee:@me is:open".to_string()
}

#[derive(Debug, Deserialize)]
struct GitHubConfig {
    token: String,
    #[serde(default = "default_query")]
    query: String,
    #[serde(default)]
    read_only: bool,
}

impl GitHubConfig {
    fn from_value(v: &serde_json::Value) -> Result<Self, String> {
        serde_json::from_value(v.clone()).map_err(|e| format!("Invalid GitHub config: {e}"))
    }
}

// ── HTTP client ───────────────────────────────────────────────────────────────

fn make_client(token: &str) -> Result<Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|_| "Invalid token format".to_string())?,
    );
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "X-GitHub-Api-Version",
        reqwest::header::HeaderValue::from_static("2022-11-28"),
    );
    reqwest::Client::builder()
        .default_headers(headers)
        .user_agent("tasky/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))
}

// ── GitHub API types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GitHubUser {
    login: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRepo {
    full_name: String,
    name: String,
}

/// An issue as returned by the Issues or Search API
#[derive(Debug, Deserialize)]
struct GitHubIssue {
    number: u64,
    title: String,
    body: Option<String>,
    /// "open" or "closed"
    state: String,
    labels: Vec<GitHubLabel>,
    updated_at: String,
    closed_at: Option<String>,
    /// Present on pull requests; we skip those
    pull_request: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct GitHubLabel {
    name: String,
}

/// Minimal response fields after creating or updating an issue
#[derive(Debug, Deserialize)]
struct GitHubIssueResponse {
    number: u64,
    updated_at: String,
}

// ── Request bodies ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct CreateIssueRequest {
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    labels: Vec<String>,
}

#[derive(Debug, Serialize)]
struct UpdateIssueRequest {
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    labels: Vec<String>,
    state: String,
}

/// Response envelope from the GitHub Search API.
#[derive(Debug, Deserialize)]
struct GitHubSearchResponse {
    items: Vec<GitHubIssue>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Search issues for a repo using the GitHub Search API.
///
/// The caller's `user_query` (e.g. `"assignee:@me is:open"`) is scoped
/// automatically with `repo:{repo_full_name} is:issue` to exclude PRs and
/// stay within the right repo. Results from the search API are also filtered
/// for `pull_request.is_none()` as a belt-and-suspenders safeguard.
///
/// Max 1 000 results (GitHub Search API cap). Rate limit: 10 req/min for
/// unauthenticated; 30 req/min for authenticated.
async fn search_issues(
    client: &Client,
    repo_full_name: &str,
    user_query: &str,
) -> Result<Vec<GitHubIssue>, String> {
    let mut all_issues: Vec<GitHubIssue> = Vec::new();
    let mut page: u32 = 1;

    // Build the scoped query once
    let scoped_query = format!("{user_query} repo:{repo_full_name} is:issue");

    loop {
        let resp = client
            .get(format!("{GITHUB_API_BASE}/search/issues"))
            .query(&[
                ("q", scoped_query.as_str()),
                ("per_page", "100"),
                ("page", &page.to_string()),
            ])
            .send()
            .await
            .map_err(|e| format!("GitHub Search API request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GitHub Search API error {status}: {body}"));
        }

        let search_resp: GitHubSearchResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse search response: {e}"))?;

        let count = search_resp.items.len();
        all_issues.extend(search_resp.items);

        // GitHub Search API caps at 1 000 results; stop when a page is partial
        if count < 100 {
            break;
        }
        page += 1;
    }

    // Belt-and-suspenders: drop anything that looks like a PR
    Ok(all_issues
        .into_iter()
        .filter(|i| i.pull_request.is_none())
        .collect())
}

/// Build the body text to push to GitHub from a task's description and notes.
/// Returns None if both are empty.
fn build_issue_body(description: &str, notes: &str) -> Option<String> {
    let desc = description.trim();
    let notes = notes.trim();
    match (desc.is_empty(), notes.is_empty()) {
        (true, true) => None,
        (false, true) => Some(desc.to_string()),
        (true, false) => Some(notes.to_string()),
        (false, false) => Some(format!("{desc}\n\n---\n{notes}")),
    }
}

/// Convert a GitHub issue into a ProviderTask.
fn issue_to_provider_task(issue: &GitHubIssue, repo_full_name: &str) -> ProviderTask {
    ProviderTask {
        remote_id: issue.number.to_string(),
        title: issue.title.clone(),
        description: issue.body.clone(),
        due_date: None, // GitHub issues have no native due date
        priority: None, // GitHub issues have no native priority field
        tags: issue.labels.iter().map(|l| l.name.clone()).collect(),
        completed: issue.state == "closed",
        completed_at: issue.closed_at.clone(),
        rrule: None,
        parent_remote_id: None,
        notes: None,
        time_estimate: None,
        source_event_uid: None,
        etag: issue.updated_at.clone(),
        href: format!(
            "{GITHUB_API_BASE}/repos/{repo_full_name}/issues/{}",
            issue.number
        ),
    }
}

// ── SyncProvider implementation ───────────────────────────────────────────────

pub struct GitHubProvider;

impl SyncProvider for GitHubProvider {
    fn provider_id() -> &'static str {
        "github"
    }

    async fn test_connection(config: &serde_json::Value) -> Result<bool, String> {
        let cfg = GitHubConfig::from_value(config)?;
        let client = make_client(&cfg.token)?;

        let resp = client
            .get(format!("{GITHUB_API_BASE}/user"))
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        if resp.status().is_success() {
            let user: GitHubUser = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse user: {e}"))?;
            eprintln!("[github] Connected as {}", user.login);
            Ok(true)
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            Err(format!("Authentication failed ({status}): {body}"))
        }
    }

    async fn discover_calendars(
        config: &serde_json::Value,
    ) -> Result<Vec<ProviderCalendar>, String> {
        let cfg = GitHubConfig::from_value(config)?;
        let client = make_client(&cfg.token)?;

        let mut all_repos: Vec<GitHubRepo> = Vec::new();
        let mut page: u32 = 1;

        loop {
            let url = format!(
                "{GITHUB_API_BASE}/user/repos?type=all&sort=updated&per_page=100&page={page}"
            );
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Failed to list repositories ({status}): {body}"));
            }

            let repos: Vec<GitHubRepo> = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse repos: {e}"))?;

            let count = repos.len();
            all_repos.extend(repos);

            if count < 100 {
                break;
            }
            page += 1;
        }

        let calendars = all_repos
            .into_iter()
            .map(|r| ProviderCalendar {
                id: r.full_name,
                display_name: Some(r.name),
                color: None,
                supports_sync: true,
            })
            .collect();

        Ok(calendars)
    }

    async fn sync(
        config: &serde_json::Value,
        // The repository full name, e.g. "owner/repo"
        calendar_id: &str,
        pending: Vec<TaskPushInput>,
        deleted: Vec<TaskDeleteInput>,
    ) -> Result<SyncOutput, String> {
        let cfg = GitHubConfig::from_value(config)?;
        let client = make_client(&cfg.token)?;

        let mut pushed: Vec<PushResult> = Vec::new();
        let mut push_errors: Vec<String> = Vec::new();
        let mut delete_errors: Vec<String> = Vec::new();

        // ── Push pending tasks (skipped when read-only) ───────────────────────

        if !cfg.read_only {
        for task in &pending {
            let body_text = build_issue_body(&task.description, &task.notes);
            let issue_number = task
                .remote_id
                .as_deref()
                .and_then(|id| id.parse::<u64>().ok());

            // Serialise the request body explicitly so any error surfaces here
            // rather than being swallowed inside reqwest's RequestBuilder and
            // causing a confusing transport-level error on send().
            let (request_url, json_bytes, is_patch) = if let Some(number) = issue_number {
                let update = UpdateIssueRequest {
                    title: task.title.clone(),
                    body: body_text,
                    labels: task.tags.clone(),
                    state: if task.completed {
                        "closed".to_string()
                    } else {
                        "open".to_string()
                    },
                };
                let bytes = match serde_json::to_vec(&update) {
                    Ok(b) => b,
                    Err(e) => {
                        push_errors.push(format!(
                            "Task {}: serialization error: {e}",
                            task.local_id
                        ));
                        continue;
                    }
                };
                (
                    format!("{GITHUB_API_BASE}/repos/{calendar_id}/issues/{number}"),
                    bytes,
                    true,
                )
            } else {
                let create = CreateIssueRequest {
                    title: task.title.clone(),
                    body: body_text,
                    labels: task.tags.clone(),
                };
                let bytes = match serde_json::to_vec(&create) {
                    Ok(b) => b,
                    Err(e) => {
                        push_errors.push(format!(
                            "Task {}: serialization error: {e}",
                            task.local_id
                        ));
                        continue;
                    }
                };
                (
                    format!("{GITHUB_API_BASE}/repos/{calendar_id}/issues"),
                    bytes,
                    false,
                )
            };

            let builder = if is_patch {
                client.patch(&request_url)
            } else {
                client.post(&request_url)
            };

            let result = builder
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(json_bytes)
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => {
                    match resp.json::<GitHubIssueResponse>().await {
                        Ok(issue) => pushed.push(PushResult {
                            local_id: task.local_id.clone(),
                            remote_id: issue.number.to_string(),
                            etag: issue.updated_at,
                            href: format!(
                                "{GITHUB_API_BASE}/repos/{calendar_id}/issues/{}",
                                issue.number
                            ),
                        }),
                        Err(e) => push_errors.push(format!(
                            "Task {}: failed to parse response: {e}",
                            task.local_id
                        )),
                    }
                }
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    push_errors.push(format!(
                        "Task {}: GitHub returned {status}: {body}",
                        task.local_id
                    ));
                }
                Err(e) => push_errors.push(format!("Task {}: request failed: {e}", task.local_id)),
            }
        }
        } // end if !cfg.read_only

        // ── Close deleted tasks (skipped when read-only) ──────────────────────
        // GitHub does not support true deletion of issues, so we close them.

        if !cfg.read_only {
        for d in &deleted {
            // href is formatted as "{API_BASE}/repos/{owner}/{repo}/issues/{number}"
            if let Some(number_str) = d.href.rsplit('/').next() {
                if let Ok(number) = number_str.parse::<u64>() {
                    let close_bytes = br#"{"state":"closed"}"#;
                    let url = format!(
                        "{GITHUB_API_BASE}/repos/{calendar_id}/issues/{number}"
                    );
                    match client
                        .patch(&url)
                        .header(reqwest::header::CONTENT_TYPE, "application/json")
                        .body(close_bytes.as_ref())
                        .send()
                        .await
                    {
                        Ok(resp) if !resp.status().is_success() => {
                            let status = resp.status();
                            let body = resp.text().await.unwrap_or_default();
                            delete_errors.push(format!(
                                "Issue #{number}: GitHub returned {status}: {body}"
                            ));
                        }
                        Err(e) => delete_errors.push(format!("Issue #{number}: {e}")),
                        Ok(_) => {}
                    }
                }
            }
        }
        } // end if !cfg.read_only

        // ── Fetch remote issues via Search API ───────────────────────────────

        let (remote_tasks, fetch_error) = match search_issues(&client, calendar_id, &cfg.query).await {
            Ok(issues) => (
                issues
                    .iter()
                    .map(|i| issue_to_provider_task(i, calendar_id))
                    .collect(),
                None,
            ),
            Err(e) => (vec![], Some(e)),
        };

        Ok(SyncOutput {
            pushed,
            push_errors,
            delete_errors,
            remote_tasks,
            fetch_error,
        })
    }

    async fn fetch_events(
        _config: &serde_json::Value,
        _calendar_id: &str,
        _range_start: &str,
        _range_end: &str,
    ) -> Result<Vec<ProviderEvent>, String> {
        // GitHub issues are not calendar events; always return empty.
        Ok(vec![])
    }
}
