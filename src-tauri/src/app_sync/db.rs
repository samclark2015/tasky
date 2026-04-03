use crate::app_sync::bundle::*;
use rusqlite::{params, Connection};
/// Direct SQLite access for App Sync bundle read/write.
///
/// Uses a separate `rusqlite::Connection` to the same tasky.db file.
/// This is safe because tauri-plugin-sql opens the DB in WAL mode,
/// allowing concurrent readers and one writer from the same process.
use std::path::Path;

pub fn open(db_path: &Path) -> Result<Connection, String> {
    let conn =
        Connection::open(db_path).map_err(|e| format!("failed to open DB for app sync: {e}"))?;
    // Enable WAL mode to allow concurrent access with tauri-plugin-sql's connection.
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("WAL pragma failed: {e}"))?;
    Ok(conn)
}

// ── Read all tables into a StateBundle ────────────────────────────────────────

pub fn read_bundle(conn: &Connection) -> Result<StateBundle, String> {
    let tasks = read_tasks(conn)?;
    let lists = read_lists(conn)?;
    let provider_accounts = read_provider_accounts(conn)?;
    let provider_maps = read_provider_maps(conn)?;
    let settings = read_settings(conn)?;
    let app_sync_accounts = read_app_sync_accounts(conn)?;

    Ok(StateBundle {
        v: 1,
        created_at: chrono::Utc::now().to_rfc3339(),
        tasks,
        lists,
        provider_accounts,
        provider_maps,
        settings,
        app_sync_accounts,
    })
}

fn read_tasks(conn: &Connection) -> Result<Vec<BundleTask>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, list_id, parent_id, title, description, due_date, priority, tags, \
                  recurrence, completed, completed_at, created_at, updated_at, deleted_at, \
                  time_estimate, time_spent, notes, etag, remote_id, sync_status, source_event_uid, \
                  recurrence_chain_id \
                  FROM tasks",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BundleTask {
                id: row.get(0)?,
                list_id: row.get(1)?,
                parent_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                due_date: row.get(5)?,
                priority: row
                    .get::<_, Option<String>>(6)?
                    .unwrap_or_else(|| "medium".into()),
                tags: row
                    .get::<_, Option<String>>(7)?
                    .unwrap_or_else(|| "[]".into()),
                recurrence: row.get(8)?,
                completed: row.get::<_, i64>(9)? != 0,
                completed_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                deleted_at: row.get(13)?,
                time_estimate: row.get(14)?,
                time_spent: row.get::<_, Option<i64>>(15)?.unwrap_or(0),
                notes: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                etag: row.get(17)?,
                remote_id: row.get(18)?,
                sync_status: row
                    .get::<_, Option<String>>(19)?
                    .unwrap_or_else(|| "pending".into()),
                source_event_uid: row.get(20)?,
                recurrence_chain_id: row.get(21)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn read_lists(conn: &Connection) -> Result<Vec<BundleList>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, color, remote_url, created_at, updated_at, deleted_at FROM lists",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BundleList {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                remote_url: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn read_provider_accounts(conn: &Connection) -> Result<Vec<BundleProviderAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, provider_type, display_name, credentials, last_synced_at, sync_enabled, \
                  created_at, updated_at, deleted_at FROM provider_accounts",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BundleProviderAccount {
                id: row.get(0)?,
                provider_type: row.get(1)?,
                display_name: row.get(2)?,
                credentials: row
                    .get::<_, Option<String>>(3)?
                    .unwrap_or_else(|| "{}".into()),
                last_synced_at: row.get(4)?,
                sync_enabled: row.get::<_, i64>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                deleted_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn read_provider_maps(conn: &Connection) -> Result<Vec<BundleProviderMap>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, account_id, list_id, source_id, source_name, settings, \
                  created_at, updated_at, deleted_at FROM provider_maps",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BundleProviderMap {
                id: row.get(0)?,
                account_id: row.get(1)?,
                list_id: row.get(2)?,
                source_id: row.get(3)?,
                source_name: row.get(4)?,
                settings: row
                    .get::<_, Option<String>>(5)?
                    .unwrap_or_else(|| "{}".into()),
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                deleted_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn read_settings(conn: &Connection) -> Result<Vec<BundleSetting>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BundleSetting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn read_app_sync_accounts(conn: &Connection) -> Result<Vec<BundleAppSyncAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, provider_type, server_url, username, bundle_path, \
                  created_at, updated_at, deleted_at FROM app_sync_accounts",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BundleAppSyncAccount {
                id: row.get(0)?,
                provider_type: row.get(1)?,
                server_url: row.get(2)?,
                username: row.get(3)?,
                bundle_path: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                deleted_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

// ── Write a merged bundle back to the DB ─────────────────────────────────────

pub fn write_bundle(conn: &Connection, bundle: &StateBundle) -> Result<(), String> {
    // Use a transaction for atomicity.
    conn.execute_batch("PRAGMA defer_foreign_keys = ON; BEGIN")
        .map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        upsert_lists(conn, &bundle.lists)?;
        upsert_tasks(conn, &bundle.tasks)?;
        upsert_provider_accounts(conn, &bundle.provider_accounts)?;
        upsert_provider_maps(conn, &bundle.provider_maps)?;
        upsert_settings(conn, &bundle.settings)?;
        upsert_app_sync_accounts(conn, &bundle.app_sync_accounts)?;
        Ok(())
    })();

    match result {
        Ok(()) => conn.execute_batch("COMMIT").map_err(|e| e.to_string()),
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

fn upsert_tasks(conn: &Connection, tasks: &[BundleTask]) -> Result<(), String> {
    for t in tasks {
        conn.execute(
            "INSERT INTO tasks (id, list_id, parent_id, title, description, due_date, priority, \
             tags, recurrence, completed, completed_at, created_at, updated_at, deleted_at, \
             time_estimate, time_spent, notes, etag, remote_id, sync_status, source_event_uid, \
             recurrence_chain_id) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22) \
             ON CONFLICT(id) DO UPDATE SET \
               list_id=excluded.list_id, parent_id=excluded.parent_id, title=excluded.title, \
               description=excluded.description, due_date=excluded.due_date, priority=excluded.priority, \
               tags=excluded.tags, recurrence=excluded.recurrence, completed=excluded.completed, \
               completed_at=excluded.completed_at, updated_at=excluded.updated_at, \
               deleted_at=excluded.deleted_at, time_estimate=excluded.time_estimate, \
               time_spent=excluded.time_spent, notes=excluded.notes, etag=excluded.etag, \
               remote_id=excluded.remote_id, sync_status=excluded.sync_status, \
               source_event_uid=excluded.source_event_uid, \
               recurrence_chain_id=excluded.recurrence_chain_id \
             WHERE excluded.updated_at > tasks.updated_at OR excluded.deleted_at > tasks.deleted_at OR tasks.deleted_at IS NULL AND excluded.deleted_at IS NOT NULL",
            params![
                t.id, t.list_id, t.parent_id, t.title, t.description, t.due_date, t.priority,
                t.tags, t.recurrence, t.completed as i64, t.completed_at,
                t.created_at, t.updated_at, t.deleted_at,
                t.time_estimate, t.time_spent, t.notes, t.etag, t.remote_id,
                t.sync_status, t.source_event_uid, t.recurrence_chain_id,
            ],
        ).map_err(|e| format!("upsert task {}: {e}", t.id))?;
    }
    Ok(())
}

fn upsert_lists(conn: &Connection, lists: &[BundleList]) -> Result<(), String> {
    for l in lists {
        conn.execute(
            "INSERT INTO lists (id, name, color, remote_url, created_at, updated_at, deleted_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7) \
             ON CONFLICT(id) DO UPDATE SET \
               name=excluded.name, color=excluded.color, remote_url=excluded.remote_url, \
               updated_at=excluded.updated_at, deleted_at=excluded.deleted_at \
             WHERE excluded.updated_at > lists.updated_at OR excluded.deleted_at > lists.deleted_at OR lists.deleted_at IS NULL AND excluded.deleted_at IS NOT NULL",
            params![l.id, l.name, l.color, l.remote_url, l.created_at, l.updated_at, l.deleted_at],
        ).map_err(|e| format!("upsert list {}: {e}", l.id))?;
    }
    Ok(())
}

fn upsert_provider_accounts(
    conn: &Connection,
    accounts: &[BundleProviderAccount],
) -> Result<(), String> {
    for a in accounts {
        conn.execute(
            "INSERT INTO provider_accounts (id, provider_type, display_name, credentials, \
             last_synced_at, sync_enabled, created_at, updated_at, deleted_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) \
             ON CONFLICT(id) DO UPDATE SET \
               display_name=excluded.display_name, credentials=excluded.credentials, \
               last_synced_at=excluded.last_synced_at, sync_enabled=excluded.sync_enabled, \
               updated_at=excluded.updated_at, deleted_at=excluded.deleted_at \
             WHERE excluded.updated_at > provider_accounts.updated_at OR excluded.deleted_at > provider_accounts.deleted_at OR provider_accounts.deleted_at IS NULL AND excluded.deleted_at IS NOT NULL",
            params![
                a.id, a.provider_type, a.display_name, a.credentials,
                a.last_synced_at, a.sync_enabled as i64,
                a.created_at, a.updated_at, a.deleted_at,
            ],
        ).map_err(|e| format!("upsert provider account {}: {e}", a.id))?;
    }
    Ok(())
}

fn upsert_provider_maps(conn: &Connection, maps: &[BundleProviderMap]) -> Result<(), String> {
    for m in maps {
        conn.execute(
            "INSERT INTO provider_maps (id, account_id, list_id, source_id, source_name, settings, \
             created_at, updated_at, deleted_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) \
             ON CONFLICT(id) DO UPDATE SET \
               account_id=excluded.account_id, list_id=excluded.list_id, \
               source_id=excluded.source_id, source_name=excluded.source_name, \
               settings=excluded.settings, updated_at=excluded.updated_at, \
               deleted_at=excluded.deleted_at \
             WHERE excluded.updated_at > provider_maps.updated_at OR excluded.deleted_at > provider_maps.deleted_at OR provider_maps.deleted_at IS NULL AND excluded.deleted_at IS NOT NULL",
            params![
                m.id, m.account_id, m.list_id, m.source_id, m.source_name, m.settings,
                m.created_at, m.updated_at, m.deleted_at,
            ],
        ).map_err(|e| format!("upsert provider map {}: {e}", m.id))?;
    }
    Ok(())
}

fn upsert_settings(conn: &Connection, settings: &[BundleSetting]) -> Result<(), String> {
    for s in settings {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![s.key, s.value],
        )
        .map_err(|e| format!("upsert setting {}: {e}", s.key))?;
    }
    Ok(())
}

fn upsert_app_sync_accounts(
    conn: &Connection,
    accounts: &[BundleAppSyncAccount],
) -> Result<(), String> {
    for a in accounts {
        conn.execute(
            "INSERT INTO app_sync_accounts (id, provider_type, server_url, username, bundle_path, \
             created_at, updated_at, deleted_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8) \
             ON CONFLICT(id) DO UPDATE SET \
               provider_type=excluded.provider_type, server_url=excluded.server_url, \
               username=excluded.username, bundle_path=excluded.bundle_path, \
               updated_at=excluded.updated_at, deleted_at=excluded.deleted_at \
             WHERE excluded.updated_at > app_sync_accounts.updated_at OR excluded.deleted_at > app_sync_accounts.deleted_at OR app_sync_accounts.deleted_at IS NULL AND excluded.deleted_at IS NOT NULL",
            params![
                a.id, a.provider_type, a.server_url, a.username, a.bundle_path,
                a.created_at, a.updated_at, a.deleted_at,
            ],
        ).map_err(|e| format!("upsert app sync account {}: {e}", a.id))?;
    }
    Ok(())
}
