/// Bundle storage transport layer.
///
/// `BundleStorage` is a trait for pushing/pulling the encrypted state bundle.
/// The WebDAV implementation uses HTTP PUT/GET with Basic Auth via reqwest.
/// The optional ETag header is used for optimistic concurrency — if the server
/// returns 412 on PUT (ETag mismatch), we've been racing another push which
/// is unusual in the sequential-use pattern but handled gracefully.

use reqwest::{Client, StatusCode};
use base64::{engine::general_purpose::STANDARD, Engine};

// ── Connection config ─────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct StorageConfig {
    pub provider_type: String,
    pub server_url: String,
    pub username: String,
    pub password: String,
    pub bundle_path: String,
}

impl StorageConfig {
    /// Build the full URL for the bundle resource.
    pub fn bundle_url(&self) -> String {
        let base = self.server_url.trim_end_matches('/');
        let path = self.bundle_path.trim_start_matches('/');
        format!("{base}/{path}")
    }
}

// ── Result type ───────────────────────────────────────────────────────────────

pub struct PullResult {
    pub data: Vec<u8>,
    pub etag: String,
}

// ── Transport operations ──────────────────────────────────────────────────────

fn basic_auth_header(username: &str, password: &str) -> String {
    let encoded = STANDARD.encode(format!("{username}:{password}"));
    format!("Basic {encoded}")
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("failed to build HTTP client: {e}"))
}

/// Upload `data` to the storage URL, optionally checking the current ETag.
/// Returns the new ETag from the server response.
pub async fn push(config: &StorageConfig, data: &[u8], current_etag: Option<&str>) -> Result<String, String> {
    let client = build_client()?;
    let url = config.bundle_url();
    let auth = basic_auth_header(&config.username, &config.password);

    // Try to create parent collection first (idempotent MKCOL)
    ensure_parent_collection(config, &client, &auth).await;

    let mut req = client
        .put(&url)
        .header("Authorization", &auth)
        .header("Content-Type", "application/octet-stream")
        .body(data.to_vec());

    if let Some(etag) = current_etag {
        req = req.header("If-Match", etag);
    }

    let resp = req.send().await.map_err(|e| format!("push request failed: {e}"))?;

    match resp.status() {
        StatusCode::CREATED | StatusCode::NO_CONTENT | StatusCode::OK => {
            let etag = resp
                .headers()
                .get("ETag")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .trim_matches('"')
                .to_string();
            Ok(etag)
        }
        StatusCode::PRECONDITION_FAILED => {
            Err("ETag mismatch — another device pushed while we were preparing. Pull first.".to_string())
        }
        status => {
            let body = resp.text().await.unwrap_or_default();
            Err(format!("push failed with status {status}: {body}"))
        }
    }
}

/// Download the bundle from the storage URL.
/// Returns `None` if the resource doesn't exist yet (first push from Device A).
pub async fn pull(config: &StorageConfig) -> Result<Option<PullResult>, String> {
    let client = build_client()?;
    let url = config.bundle_url();
    let auth = basic_auth_header(&config.username, &config.password);

    let resp = client
        .get(&url)
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|e| format!("pull request failed: {e}"))?;

    match resp.status() {
        StatusCode::NOT_FOUND => Ok(None),
        StatusCode::OK => {
            let etag = resp
                .headers()
                .get("ETag")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .trim_matches('"')
                .to_string();
            let data = resp.bytes().await.map_err(|e| format!("reading pull response: {e}"))?.to_vec();
            Ok(Some(PullResult { data, etag }))
        }
        status => {
            let body = resp.text().await.unwrap_or_default();
            Err(format!("pull failed with status {status}: {body}"))
        }
    }
}

/// Test that the storage location is accessible with the given credentials.
///
/// Sends a `PROPFIND depth:0` to `server_url` (the WebDAV collection root).
/// - 207 Multi-Status → WebDAV server reachable and credentials valid.
/// - 200/204 → plain HTTP server reachable and credentials valid (non-standard but accepted).
/// - 401/403 → credentials rejected.
/// - Anything else → returns an Err with the status and body for diagnosis.
pub async fn test(config: &StorageConfig) -> Result<bool, String> {
    let client = build_client()?;
    let base_url = config.server_url.trim_end_matches('/').to_string();
    let auth = basic_auth_header(&config.username, &config.password);

    let resp = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &base_url)
        .header("Authorization", &auth)
        .header("Depth", "0")
        .header("Content-Type", "application/xml")
        .body(r#"<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>"#)
        .send()
        .await
        .map_err(|e| format!("connectivity test failed: {e}"))?;

    match resp.status() {
        // Standard WebDAV success
        StatusCode::MULTI_STATUS => Ok(true),
        // Some servers return 200 for a valid PROPFIND body
        StatusCode::OK | StatusCode::NO_CONTENT => Ok(true),
        // Auth failure
        StatusCode::UNAUTHORIZED => Err(format!(
            "Authentication failed (401). Check your username and password. \
             For Nextcloud, use an app password if 2FA is enabled."
        )),
        StatusCode::FORBIDDEN => Err(
            "Access forbidden (403). Check that your account has WebDAV access.".to_string()
        ),
        StatusCode::NOT_FOUND => Err(format!(
            "URL not found (404). For Nextcloud the WebDAV URL is: \
             {base_url}/remote.php/dav/files/{{username}}/"
        )),
        status => {
            let body = resp.text().await.unwrap_or_default();
            let snippet = if body.len() > 200 { &body[..200] } else { &body };
            Err(format!("Unexpected response {status}: {snippet}"))
        }
    }
}

/// Attempt to create the parent WebDAV collection (/.tasky-sync/).
/// Failure is silently ignored — the PUT will fail with a proper error if this is needed.
async fn ensure_parent_collection(config: &StorageConfig, client: &Client, auth: &str) {
    let bundle_url = config.bundle_url();
    // Extract parent path from URL
    if let Some(slash_pos) = bundle_url.rfind('/') {
        let parent_url = &bundle_url[..slash_pos];
        if parent_url.len() > config.server_url.trim_end_matches('/').len() {
            let _ = client
                .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), parent_url)
                .header("Authorization", auth)
                .send()
                .await;
        }
    }
}
