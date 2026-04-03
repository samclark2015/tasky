export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        caldav_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
        parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        due_date TEXT,
        priority TEXT DEFAULT 'medium',
        tags TEXT DEFAULT '[]',
        recurrence TEXT,
        completed INTEGER DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        time_estimate INTEGER,
        time_spent INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        etag TEXT,
        caldav_uid TEXT,
        sync_status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS caldav_accounts (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        server_url TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        last_synced_at TEXT,
        sync_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS caldav_calendar_map (
        list_id TEXT PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES caldav_accounts(id) ON DELETE CASCADE,
        calendar_href TEXT NOT NULL,
        sync_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_caldav_uid ON tasks(caldav_uid);
      CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks(sync_status);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE tasks ADD COLUMN source_event_uid TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_source_event_uid ON tasks(source_event_uid);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS github_accounts (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        token TEXT NOT NULL,
        last_synced_at TEXT,
        sync_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS github_repo_map (
        list_id TEXT PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES github_accounts(id) ON DELETE CASCADE,
        repo_full_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_github_repo_map_account_id ON github_repo_map(account_id);
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE github_accounts ADD COLUMN query TEXT NOT NULL DEFAULT 'assignee:@me is:open';
    `,
  },
  {
    version: 6,
    sql: `
      ALTER TABLE github_accounts ADD COLUMN read_only INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE github_repo_map ADD COLUMN query TEXT;
      ALTER TABLE github_repo_map ADD COLUMN read_only INTEGER;
    `,
  },
  {
    version: 8,
    sql: `
      ALTER TABLE github_accounts DROP COLUMN query;
      ALTER TABLE github_accounts DROP COLUMN read_only;
    `,
  },
  {
    version: 9,
    sql: `
      -- Recreate caldav_calendar_map without the FK on list_id so that
      -- events-only calendar entries (which have no corresponding list) are
      -- supported. list_id remains the PK but is no longer FK-constrained.
      CREATE TABLE caldav_calendar_map_v2 (
        list_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES caldav_accounts(id) ON DELETE CASCADE,
        calendar_href TEXT NOT NULL,
        events_only INTEGER NOT NULL DEFAULT 0,
        sync_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO caldav_calendar_map_v2
        SELECT list_id, account_id, calendar_href, 0, sync_token, created_at, updated_at
        FROM caldav_calendar_map;

      DROP TABLE caldav_calendar_map;
      ALTER TABLE caldav_calendar_map_v2 RENAME TO caldav_calendar_map;

      CREATE INDEX IF NOT EXISTS idx_caldav_calendar_map_account_id
        ON caldav_calendar_map(account_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_caldav_uid2 ON tasks(caldav_uid);
    `,
  },
  {
    version: 10,
    sql: `
      -- ── Unified provider tables ─────────────────────────────────────────────

      CREATE TABLE IF NOT EXISTS provider_accounts (
        id TEXT PRIMARY KEY,
        provider_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        credentials TEXT NOT NULL DEFAULT '{}',
        last_synced_at TEXT,
        sync_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_maps (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        list_id TEXT,
        source_id TEXT NOT NULL,
        source_name TEXT,
        settings TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Migrate CalDAV accounts
      INSERT OR IGNORE INTO provider_accounts (id, provider_type, display_name, credentials, last_synced_at, sync_enabled, created_at, updated_at)
        SELECT id, 'caldav', display_name,
          json_object('server_url', server_url, 'username', username, 'password', password),
          last_synced_at, sync_enabled, created_at, updated_at
        FROM caldav_accounts;

      -- Migrate GitHub accounts
      INSERT OR IGNORE INTO provider_accounts (id, provider_type, display_name, credentials, last_synced_at, sync_enabled, created_at, updated_at)
        SELECT id, 'github', display_name,
          json_object('token', token),
          last_synced_at, sync_enabled, created_at, updated_at
        FROM github_accounts;

      -- Migrate CalDAV calendar maps (list_id used as map id since it was PK)
      INSERT OR IGNORE INTO provider_maps (id, account_id, list_id, source_id, source_name, settings, created_at, updated_at)
        SELECT list_id, account_id, list_id, calendar_href, NULL,
          json_object('events_only', events_only, 'sync_token', sync_token),
          created_at, updated_at
        FROM caldav_calendar_map;

      -- Migrate GitHub repo maps (list_id used as map id since it was PK)
      INSERT OR IGNORE INTO provider_maps (id, account_id, list_id, source_id, source_name, settings, created_at, updated_at)
        SELECT list_id, account_id, list_id, repo_full_name, repo_full_name,
          json_object('query', query, 'read_only', read_only),
          created_at, updated_at
        FROM github_repo_map;

      -- Rename columns on tasks and lists
      ALTER TABLE tasks RENAME COLUMN caldav_uid TO remote_id;
      ALTER TABLE lists RENAME COLUMN caldav_url TO remote_url;

      -- Drop old provider-specific tables
      DROP TABLE IF EXISTS caldav_calendar_map;
      DROP TABLE IF EXISTS caldav_accounts;
      DROP TABLE IF EXISTS github_repo_map;
      DROP TABLE IF EXISTS github_accounts;

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_provider_accounts_type ON provider_accounts(provider_type);
      CREATE INDEX IF NOT EXISTS idx_provider_maps_account ON provider_maps(account_id);
      CREATE INDEX IF NOT EXISTS idx_provider_maps_list ON provider_maps(list_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_remote_id ON tasks(remote_id);
    `,
  },
];
