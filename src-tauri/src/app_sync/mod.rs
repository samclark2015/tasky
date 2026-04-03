/// App Sync IPC commands and managed state.
///
/// Commands:
///   app_sync_setup        — configure a new app sync account (WebDAV credentials + passphrase)
///   app_sync_delete       — remove the configured app sync account
///   app_sync_test         — verify connectivity to the bundle storage
///   app_sync_push         — encrypt local state and push to storage
///   app_sync_pull         — pull from storage, decrypt, merge, write back
///   app_sync_status       — return current sync status
///   app_sync_generate_link_code — generate a link code for another device
///   app_sync_join         — bootstrap this device from a link code + passphrase

pub mod bundle;
pub mod crypto;
pub mod db;
pub mod transport;

use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use bundle::StateBundle;
use crypto::{
    encrypt, decrypt,
    LinkCodePayload, encode_link_code, decode_link_code,
};
use transport::StorageConfig;

// ── Managed state ─────────────────────────────────────────────────────────────

#[derive(Debug, Default)]
pub struct AppSyncStateInner {
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub is_syncing: bool,
}

pub type AppSyncState = Mutex<AppSyncStateInner>;

// ── Wire types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSyncAccountConfig {
    pub provider_type: String,
    pub server_url: String,
    pub username: String,
    pub password: String,
    pub bundle_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppSyncStatusOutput {
    pub configured: bool,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub is_syncing: bool,
    pub account_id: Option<String>,
    pub server_url: Option<String>,
    pub username: Option<String>,
}

// ── DB path helper ────────────────────────────────────────────────────────────

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not determine app data dir: {e}"))?;
    path.push("tasky.db");
    Ok(path)
}

// ── Build StorageConfig from DB ───────────────────────────────────────────────

fn storage_config_from_db(app: &AppHandle) -> Result<Option<StorageConfig>, String> {
    let path = db_path(app)?;
    let conn = db::open(&path)?;

    let account = {
        let mut stmt = conn
            .prepare("SELECT id, provider_type, server_url, username, password, bundle_path \
                      FROM app_sync_accounts WHERE deleted_at IS NULL LIMIT 1")
            .map_err(|e| e.to_string())?;

        struct Row { id: String, provider_type: String, server_url: String, username: String, password: String, bundle_path: String }

        let mut rows = stmt.query_map([], |row| {
            Ok(Row {
                id: row.get(0)?,
                provider_type: row.get(1)?,
                server_url: row.get(2)?,
                username: row.get(3)?,
                password: row.get(4)?,
                bundle_path: row.get(5)?,
            })
        }).map_err(|e| e.to_string())?;

        rows.next().transpose().map_err(|e| e.to_string())?
    };

    let Some(row) = account else { return Ok(None); };

    if row.password.is_empty() {
        return Err("app sync account has no password stored — please re-configure".to_string());
    }

    Ok(Some(StorageConfig {
        provider_type: row.provider_type,
        server_url: row.server_url,
        username: row.username,
        password: row.password,
        bundle_path: row.bundle_path,
    }))
}

/// Read the sync passphrase from the DB.
fn passphrase_from_db(app: &AppHandle) -> Result<String, String> {
    let path = db_path(app)?;
    let conn = db::open(&path)?;
    let passphrase: String = conn
        .query_row(
            "SELECT passphrase FROM app_sync_accounts WHERE deleted_at IS NULL LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("could not read passphrase from DB: {e}"))?;
    if passphrase.is_empty() {
        return Err("sync passphrase not set — please re-configure app sync".to_string());
    }
    Ok(passphrase)
}

// ── IPC Commands ─────────────────────────────────────────────────────────────

/// Configure app sync with a new account. Stores all credentials in the DB.
#[tauri::command]
pub async fn app_sync_setup(
    app: AppHandle,
    config: AppSyncAccountConfig,
    passphrase: String,
) -> Result<(), String> {
    let path = db_path(&app)?;
    let conn = db::open(&path)?;

    // Remove any existing app sync account first.
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE app_sync_accounts SET deleted_at = ?1, updated_at = ?1 WHERE deleted_at IS NULL",
        rusqlite::params![now],
    ).map_err(|e| e.to_string())?;

    // Create new account with password + passphrase stored in DB.
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO app_sync_accounts \
         (id, provider_type, server_url, username, password, passphrase, bundle_path, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        rusqlite::params![
            id, config.provider_type, config.server_url, config.username,
            config.password, passphrase, config.bundle_path, now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Remove the configured app sync account.
#[tauri::command]
pub async fn app_sync_delete(app: AppHandle) -> Result<(), String> {
    let path = db_path(&app)?;
    let conn = db::open(&path)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE app_sync_accounts SET deleted_at = ?1, updated_at = ?1 WHERE deleted_at IS NULL",
        rusqlite::params![now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Test connectivity to the bundle storage location.
#[tauri::command]
pub async fn app_sync_test(app: AppHandle) -> Result<bool, String> {
    let config = storage_config_from_db(&app)?
        .ok_or_else(|| "app sync not configured".to_string())?;
    transport::test(&config).await
}

/// Push local state to bundle storage.
#[tauri::command]
pub async fn app_sync_push(
    app: AppHandle,
    state: State<'_, AppSyncState>,
) -> Result<String, String> {
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        if s.is_syncing {
            return Err("sync already in progress".to_string());
        }
        s.is_syncing = true;
    }

    let result = do_push(&app, &state).await;

    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.is_syncing = false;
    match result {
        Ok(ref ts) => {
            s.last_sync_at = Some(ts.clone());
            s.last_error = None;
        }
        Err(ref e) => {
            s.last_error = Some(e.clone());
        }
    }
    result
}

async fn do_push(app: &AppHandle, _state: &State<'_, AppSyncState>) -> Result<String, String> {
    let config = storage_config_from_db(app)?
        .ok_or_else(|| "app sync not configured".to_string())?;
    let passphrase = passphrase_from_db(app)?;

    let path = db_path(app)?;
    let conn = db::open(&path)?;

    // Pull remote first to merge (defensive — prevents overwriting concurrent changes).
    let local_bundle = db::read_bundle(&conn)?;
    let merged = match transport::pull(&config).await? {
        None => local_bundle,
        Some(remote_result) => {
            let remote_json = decrypt(&passphrase, &remote_result.data)?;
            let remote_bundle: StateBundle = serde_json::from_slice(&remote_json)
                .map_err(|e| format!("remote bundle corrupt: {e}"))?;
            bundle::merge(local_bundle, remote_bundle)
        }
    };

    // Write merged state back locally.
    db::write_bundle(&conn, &merged)?;

    // Encrypt and push.
    let json = serde_json::to_vec(&merged).map_err(|e| e.to_string())?;
    let encrypted = encrypt(&passphrase, &json)?;
    transport::push(&config, &encrypted, None).await?;

    let ts = chrono::Utc::now().to_rfc3339();
    Ok(ts)
}

/// Pull from bundle storage, decrypt, merge with local state, write back.
#[tauri::command]
pub async fn app_sync_pull(
    app: AppHandle,
    state: State<'_, AppSyncState>,
) -> Result<String, String> {
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        if s.is_syncing {
            return Err("sync already in progress".to_string());
        }
        s.is_syncing = true;
    }

    let result = do_pull(&app).await;

    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.is_syncing = false;
    match result {
        Ok(ref ts) => {
            s.last_sync_at = Some(ts.clone());
            s.last_error = None;
        }
        Err(ref e) => {
            s.last_error = Some(e.clone());
        }
    }
    result
}

async fn do_pull(app: &AppHandle) -> Result<String, String> {
    let config = storage_config_from_db(app)?
        .ok_or_else(|| "app sync not configured".to_string())?;
    let passphrase = passphrase_from_db(app)?;

    let remote_result = transport::pull(&config).await?;
    let Some(remote_result) = remote_result else {
        return Ok("no remote bundle found — nothing to pull".to_string());
    };

    let remote_json = decrypt(&passphrase, &remote_result.data)?;
    let remote_bundle: StateBundle = serde_json::from_slice(&remote_json)
        .map_err(|e| format!("remote bundle corrupt: {e}"))?;

    let path = db_path(app)?;
    let conn = db::open(&path)?;
    let local_bundle = db::read_bundle(&conn)?;
    let merged = bundle::merge(local_bundle, remote_bundle);
    db::write_bundle(&conn, &merged)?;

    let ts = chrono::Utc::now().to_rfc3339();
    Ok(ts)
}

/// Get current app sync status.
#[tauri::command]
pub fn app_sync_status(
    app: AppHandle,
    state: State<'_, AppSyncState>,
) -> Result<AppSyncStatusOutput, String> {
    let s = state.lock().map_err(|e| e.to_string())?;

    // Quick DB check for configured account.
    let path = db_path(&app)?;
    let account_info: Option<(String, String, String)> = if let Ok(conn) = db::open(&path) {
        conn.query_row(
            "SELECT id, server_url, username FROM app_sync_accounts WHERE deleted_at IS NULL LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).ok()
    } else {
        None
    };

    Ok(AppSyncStatusOutput {
        configured: account_info.is_some(),
        last_sync_at: s.last_sync_at.clone(),
        last_error: s.last_error.clone(),
        is_syncing: s.is_syncing,
        account_id: account_info.as_ref().map(|(id, _, _)| id.clone()),
        server_url: account_info.as_ref().map(|(_, url, _)| url.clone()),
        username: account_info.as_ref().map(|(_, _, u)| u.clone()),
    })
}

/// Generate a link code that another device can use to bootstrap.
#[tauri::command]
pub async fn app_sync_generate_link_code(app: AppHandle) -> Result<String, String> {
    let config = storage_config_from_db(&app)?
        .ok_or_else(|| "app sync not configured".to_string())?;
    let passphrase = passphrase_from_db(&app)?;

    let payload = LinkCodePayload {
        v: 1,
        provider_type: config.provider_type,
        url: config.server_url,
        user: config.username,
        pass: config.password,
        path: config.bundle_path,
    };

    encode_link_code(&passphrase, &payload)
}

/// Bootstrap this device from a link code + passphrase.
/// Decodes the link code, configures app sync, and performs an initial pull.
#[tauri::command]
pub async fn app_sync_join(
    app: AppHandle,
    state: State<'_, AppSyncState>,
    link_code: String,
    passphrase: String,
) -> Result<String, String> {
    // Decode the link code to get connection info.
    let payload = decode_link_code(&passphrase, &link_code)?;

    // Set up the account in DB + keychain.
    let config = AppSyncAccountConfig {
        provider_type: payload.provider_type,
        server_url: payload.url,
        username: payload.user,
        password: payload.pass,
        bundle_path: payload.path,
    };
    app_sync_setup(app.clone(), config, passphrase).await?;

    // Perform initial pull to materialize all state.
    app_sync_pull(app, state).await
}
