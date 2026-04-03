use chrono::{DateTime, Duration, Utc};
/// State bundle: the encrypted JSON document that travels between devices.
///
/// Merge strategy: LWW-Element-Set CRDT per entity.
/// For each entity ID compare effective_time = max(updated_at, deleted_at).
/// Keep the version with the later effective_time.
/// Tombstones older than 90 days are pruned during merge.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Row types in the bundle ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleTask {
    pub id: String,
    pub list_id: Option<String>,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub tags: String, // JSON string
    pub recurrence: Option<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub time_estimate: Option<i64>,
    pub time_spent: i64,
    pub notes: String,
    pub etag: Option<String>,
    pub remote_id: Option<String>,
    pub sync_status: String,
    pub source_event_uid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleList {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub remote_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleProviderAccount {
    pub id: String,
    pub provider_type: String,
    pub display_name: String,
    pub credentials: String, // JSON string (contains cleartext password - ok, bundle is encrypted)
    pub last_synced_at: Option<String>,
    pub sync_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleProviderMap {
    pub id: String,
    pub account_id: String,
    pub list_id: Option<String>,
    pub source_id: String,
    pub source_name: Option<String>,
    pub settings: String, // JSON string
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleSetting {
    pub key: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleAppSyncAccount {
    pub id: String,
    pub provider_type: String,
    pub server_url: String,
    pub username: String,
    pub bundle_path: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

// ── The bundle itself ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateBundle {
    /// Schema version for forward compat.
    pub v: u32,
    /// ISO 8601 timestamp when this bundle was created.
    pub created_at: String,
    pub tasks: Vec<BundleTask>,
    pub lists: Vec<BundleList>,
    pub provider_accounts: Vec<BundleProviderAccount>,
    pub provider_maps: Vec<BundleProviderMap>,
    pub settings: Vec<BundleSetting>,
    pub app_sync_accounts: Vec<BundleAppSyncAccount>,
}

impl StateBundle {
    pub fn new() -> Self {
        StateBundle {
            v: 1,
            created_at: Utc::now().to_rfc3339(),
            tasks: vec![],
            lists: vec![],
            provider_accounts: vec![],
            provider_maps: vec![],
            settings: vec![],
            app_sync_accounts: vec![],
        }
    }
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

const TOMBSTONE_TTL_DAYS: i64 = 90;

fn parse_ts(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Effective timestamp for an entity: max(updated_at, deleted_at).
fn effective_time(updated_at: &str, deleted_at: Option<&str>) -> DateTime<Utc> {
    let updated = parse_ts(updated_at).unwrap_or(DateTime::<Utc>::MIN_UTC);
    let deleted = deleted_at
        .and_then(|s| parse_ts(s))
        .unwrap_or(DateTime::<Utc>::MIN_UTC);
    updated.max(deleted)
}

fn is_stale_tombstone(deleted_at: Option<&str>, now: DateTime<Utc>) -> bool {
    if let Some(s) = deleted_at {
        if let Some(ts) = parse_ts(s) {
            return now - ts > Duration::days(TOMBSTONE_TTL_DAYS);
        }
    }
    false
}

/// Merge two vecs of entities using LWW.
/// `id_fn` extracts the entity ID.
/// `updated_fn` extracts updated_at.
/// `deleted_fn` extracts deleted_at.
fn merge_lww<T, Id, Updated, Deleted>(
    local: Vec<T>,
    remote: Vec<T>,
    id_fn: Id,
    updated_fn: Updated,
    deleted_fn: Deleted,
    now: DateTime<Utc>,
) -> Vec<T>
where
    T: Clone,
    Id: Fn(&T) -> &str,
    Updated: Fn(&T) -> &str,
    Deleted: Fn(&T) -> Option<&str>,
{
    let mut map: HashMap<String, T> = HashMap::new();

    for item in local.into_iter().chain(remote.into_iter()) {
        let id = id_fn(&item).to_string();
        // Prune stale tombstones
        if is_stale_tombstone(deleted_fn(&item), now) {
            map.remove(&id);
            continue;
        }
        let effective = effective_time(updated_fn(&item), deleted_fn(&item));
        let keep = match map.get(&id) {
            None => true,
            Some(existing) => {
                let ex_eff = effective_time(updated_fn(existing), deleted_fn(existing));
                effective > ex_eff
            }
        };
        if keep {
            map.insert(id, item);
        }
    }

    map.into_values().collect()
}

/// Merge `remote` bundle into `local` bundle, returning the merged result.
pub fn merge(local: StateBundle, remote: StateBundle) -> StateBundle {
    let now = Utc::now();

    let tasks = merge_lww(
        local.tasks,
        remote.tasks,
        |t| t.id.as_str(),
        |t| t.updated_at.as_str(),
        |t| t.deleted_at.as_deref(),
        now,
    );

    let lists = merge_lww(
        local.lists,
        remote.lists,
        |l| l.id.as_str(),
        |l| l.updated_at.as_str(),
        |l| l.deleted_at.as_deref(),
        now,
    );

    let provider_accounts = merge_lww(
        local.provider_accounts,
        remote.provider_accounts,
        |a| a.id.as_str(),
        |a| a.updated_at.as_str(),
        |a| a.deleted_at.as_deref(),
        now,
    );

    let provider_maps = merge_lww(
        local.provider_maps,
        remote.provider_maps,
        |m| m.id.as_str(),
        |m| m.updated_at.as_str(),
        |m| m.deleted_at.as_deref(),
        now,
    );

    let app_sync_accounts = merge_lww(
        local.app_sync_accounts,
        remote.app_sync_accounts,
        |a| a.id.as_str(),
        |a| a.updated_at.as_str(),
        |a| a.deleted_at.as_deref(),
        now,
    );

    // Settings: LWW by key (no deleted_at — settings are always present)
    let mut settings_map: HashMap<String, BundleSetting> = local
        .settings
        .into_iter()
        .map(|s| (s.key.clone(), s))
        .collect();
    for s in remote.settings {
        // Remote wins by simple replace (settings don't have timestamps — last write wins via bundle age)
        settings_map.entry(s.key.clone()).or_insert(s);
    }
    let settings = settings_map.into_values().collect();

    StateBundle {
        v: 1,
        created_at: now.to_rfc3339(),
        tasks,
        lists,
        provider_accounts,
        provider_maps,
        settings,
        app_sync_accounts,
    }
}
