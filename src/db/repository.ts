import type { Task, TaskList, NewTask, NewTaskList, ProviderAccount, ProviderMap, AppSyncAccount, NewAppSyncAccount } from '@/types';

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    listId: row.list_id as string,
    parentId: (row.parent_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? '',
    dueDate: (row.due_date as string | null) ?? null,
    priority: (row.priority as Task['priority']) ?? 'medium',
    tags: JSON.parse((row.tags as string) ?? '[]'),
    recurrence: row.recurrence ? JSON.parse(row.recurrence as string) : null,
    completed: Boolean(row.completed),
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
    timeEstimate: (row.time_estimate as number | null) ?? null,
    timeSpent: (row.time_spent as number) ?? 0,
    notes: (row.notes as string) ?? '',
    etag: (row.etag as string | null) ?? null,
    remoteId: (row.remote_id as string | null) ?? null,
    syncStatus: (row.sync_status as Task['syncStatus']) ?? 'pending',
    sourceEventUid: (row.source_event_uid as string | null) ?? null,
    recurrenceChainId: (row.recurrence_chain_id as string | null) ?? null,
  };
}

function rowToList(row: Record<string, unknown>): TaskList {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
    remoteUrl: (row.remote_url as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

export function createTaskRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<Task[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC'
      );
      return rows.map(rowToTask);
    },

    async getById(id: string): Promise<Task | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      return rows.length > 0 ? rowToTask(rows[0]) : null;
    },

    async getByList(listId: string): Promise<Task[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE list_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
        [listId]
      );
      return rows.map(rowToTask);
    },

    async getDueToday(): Promise<Task[]> {
      const today = new Date().toISOString().split('T')[0];
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM tasks WHERE date(due_date) = ? AND completed = 0 AND deleted_at IS NULL ORDER BY due_date ASC",
        [today]
      );
      return rows.map(rowToTask);
    },

    async getInbox(): Promise<Task[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE list_id IS NULL AND completed = 0 AND deleted_at IS NULL ORDER BY created_at DESC'
      );
      return rows.map(rowToTask);
    },

    async create(task: NewTask & { id: string }): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO tasks (
          id, list_id, parent_id, title, description, due_date,
          priority, tags, recurrence, completed, completed_at,
          created_at, updated_at, time_estimate, time_spent, notes,
          etag, remote_id, sync_status, source_event_uid, recurrence_chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.listId || null,
          task.parentId ?? null,
          task.title,
          task.description ?? '',
          task.dueDate ?? null,
          task.priority ?? 'medium',
          JSON.stringify(task.tags ?? []),
          task.recurrence ? JSON.stringify(task.recurrence) : null,
          task.completed ? 1 : 0,
          task.completedAt ?? null,
          now,
          now,
          task.timeEstimate ?? null,
          task.timeSpent ?? 0,
          task.notes ?? '',
          task.etag ?? null,
          task.remoteId ?? null,
          'pending',
          task.sourceEventUid ?? null,
          task.recurrenceChainId ?? null,
        ]
      );
    },

    async update(id: string, updates: Partial<Task>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
      if (updates.dueDate !== undefined) { fields.push('due_date = ?'); values.push(updates.dueDate); }
      if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
      if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
      if (updates.recurrence !== undefined) { fields.push('recurrence = ?'); values.push(updates.recurrence ? JSON.stringify(updates.recurrence) : null); }
      if (updates.completed !== undefined) { fields.push('completed = ?'); values.push(updates.completed ? 1 : 0); }
      if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
      if (updates.timeEstimate !== undefined) { fields.push('time_estimate = ?'); values.push(updates.timeEstimate); }
      if (updates.timeSpent !== undefined) { fields.push('time_spent = ?'); values.push(updates.timeSpent); }
      if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
      if (updates.syncStatus !== undefined) { fields.push('sync_status = ?'); values.push(updates.syncStatus); }
      if (updates.etag !== undefined) { fields.push('etag = ?'); values.push(updates.etag); }
      if (updates.remoteId !== undefined) { fields.push('remote_id = ?'); values.push(updates.remoteId); }
      if (updates.listId !== undefined) { fields.push('list_id = ?'); values.push(updates.listId || null); }
      if (updates.parentId !== undefined) { fields.push('parent_id = ?'); values.push(updates.parentId); }
      if (updates.sourceEventUid !== undefined) { fields.push('source_event_uid = ?'); values.push(updates.sourceEventUid); }
      if (updates.recurrenceChainId !== undefined) { fields.push('recurrence_chain_id = ?'); values.push(updates.recurrenceChainId); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?',
        [now, now, id]
      );
    },
  };
}

export function createListRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<TaskList[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM lists WHERE deleted_at IS NULL ORDER BY name ASC'
      );
      return rows.map(rowToList);
    },

    async getById(id: string): Promise<TaskList | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM lists WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      return rows.length > 0 ? rowToList(rows[0]) : null;
    },

    async create(list: NewTaskList & { id: string }): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'INSERT INTO lists (id, name, color, remote_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [list.id, list.name, list.color ?? null, list.remoteUrl ?? null, now, now]
      );
    },

    async update(id: string, updates: Partial<TaskList>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
      if (updates.remoteUrl !== undefined) { fields.push('remote_url = ?'); values.push(updates.remoteUrl); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE lists SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE lists SET deleted_at = ?, updated_at = ? WHERE id = ?',
        [now, now, id]
      );
    },
  };
}

export async function getSetting(db: DatabaseAdapter, key: string): Promise<string | null> {
  const rows = await db.select<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(db: DatabaseAdapter, key: string, value: string): Promise<void> {
  await db.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

// ── Generic provider repositories ─────────────────────────────────────────────

function rowToProviderAccount(row: Record<string, unknown>): ProviderAccount {
  return {
    id: row.id as string,
    providerType: row.provider_type as string,
    displayName: row.display_name as string,
    credentials: JSON.parse((row.credentials as string) ?? '{}'),
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    syncEnabled: Boolean(row.sync_enabled),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

function rowToProviderMap(row: Record<string, unknown>): ProviderMap {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    listId: (row.list_id as string | null) ?? null,
    sourceId: row.source_id as string,
    sourceName: (row.source_name as string | null) ?? null,
    settings: JSON.parse((row.settings as string) ?? '{}'),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

export function createProviderAccountRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<ProviderAccount[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM provider_accounts WHERE deleted_at IS NULL ORDER BY display_name ASC'
      );
      return rows.map(rowToProviderAccount);
    },

    async getByType(providerType: string): Promise<ProviderAccount[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM provider_accounts WHERE provider_type = ? AND deleted_at IS NULL ORDER BY display_name ASC',
        [providerType]
      );
      return rows.map(rowToProviderAccount);
    },

    async getById(id: string): Promise<ProviderAccount | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM provider_accounts WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      return rows.length > 0 ? rowToProviderAccount(rows[0]) : null;
    },

    async create(account: ProviderAccount): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO provider_accounts
         (id, provider_type, display_name, credentials, last_synced_at, sync_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.id,
          account.providerType,
          account.displayName,
          JSON.stringify(account.credentials),
          account.lastSyncedAt ?? null,
          account.syncEnabled ? 1 : 0,
          now,
          now,
        ]
      );
    },

    async update(id: string, updates: Partial<ProviderAccount>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.displayName !== undefined) { fields.push('display_name = ?'); values.push(updates.displayName); }
      if (updates.credentials !== undefined) { fields.push('credentials = ?'); values.push(JSON.stringify(updates.credentials)); }
      if (updates.lastSyncedAt !== undefined) { fields.push('last_synced_at = ?'); values.push(updates.lastSyncedAt); }
      if (updates.syncEnabled !== undefined) { fields.push('sync_enabled = ?'); values.push(updates.syncEnabled ? 1 : 0); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE provider_accounts SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      const now = new Date().toISOString();
      // Soft-delete the maps for this account first, then the account
      await db.execute(
        'UPDATE provider_maps SET deleted_at = ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL',
        [now, now, id]
      );
      await db.execute(
        'UPDATE provider_accounts SET deleted_at = ?, updated_at = ? WHERE id = ?',
        [now, now, id]
      );
    },

    async setLastSynced(id: string, at: string): Promise<void> {
      await db.execute(
        'UPDATE provider_accounts SET last_synced_at = ?, updated_at = ? WHERE id = ?',
        [at, at, id]
      );
    },
  };
}

export function createProviderMapRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<ProviderMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM provider_maps WHERE deleted_at IS NULL'
      );
      return rows.map(rowToProviderMap);
    },

    async getByAccount(accountId: string): Promise<ProviderMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM provider_maps WHERE account_id = ? AND deleted_at IS NULL',
        [accountId]
      );
      return rows.map(rowToProviderMap);
    },

    async getByList(listId: string): Promise<ProviderMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM provider_maps WHERE list_id = ? AND deleted_at IS NULL',
        [listId]
      );
      return rows.map(rowToProviderMap);
    },

    async create(map: ProviderMap): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO provider_maps (id, account_id, list_id, source_id, source_name, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          map.id,
          map.accountId,
          map.listId ?? null,
          map.sourceId,
          map.sourceName ?? null,
          JSON.stringify(map.settings),
          now,
          now,
        ]
      );
    },

    async update(id: string, updates: Partial<ProviderMap>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.listId !== undefined) { fields.push('list_id = ?'); values.push(updates.listId); }
      if (updates.sourceId !== undefined) { fields.push('source_id = ?'); values.push(updates.sourceId); }
      if (updates.sourceName !== undefined) { fields.push('source_name = ?'); values.push(updates.sourceName); }
      if (updates.settings !== undefined) { fields.push('settings = ?'); values.push(JSON.stringify(updates.settings)); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE provider_maps SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE provider_maps SET deleted_at = ?, updated_at = ? WHERE id = ?',
        [now, now, id]
      );
    },

    async deleteByAccount(accountId: string): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE provider_maps SET deleted_at = ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL',
        [now, now, accountId]
      );
    },
  };
}

// ── App Sync Account Repository ───────────────────────────────────────────────

function rowToAppSyncAccount(row: Record<string, unknown>): AppSyncAccount {
  return {
    id: row.id as string,
    providerType: row.provider_type as string,
    serverUrl: row.server_url as string,
    username: row.username as string,
    password: (row.password as string) ?? '',
    passphrase: (row.passphrase as string) ?? '',
    bundlePath: row.bundle_path as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

export function createAppSyncAccountRepository(db: DatabaseAdapter) {
  return {
    async getActive(): Promise<AppSyncAccount | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM app_sync_accounts WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
      );
      return rows.length > 0 ? rowToAppSyncAccount(rows[0]) : null;
    },

    async getById(id: string): Promise<AppSyncAccount | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM app_sync_accounts WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      return rows.length > 0 ? rowToAppSyncAccount(rows[0]) : null;
    },

    async create(account: NewAppSyncAccount & { id: string }): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO app_sync_accounts
         (id, provider_type, server_url, username, password, passphrase, bundle_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.id,
          account.providerType,
          account.serverUrl,
          account.username,
          account.password,
          account.passphrase,
          account.bundlePath,
          now,
          now,
        ]
      );
    },

    async update(id: string, updates: Partial<Pick<AppSyncAccount, 'serverUrl' | 'username' | 'bundlePath' | 'password' | 'passphrase'>>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.serverUrl !== undefined) { fields.push('server_url = ?'); values.push(updates.serverUrl); }
      if (updates.username !== undefined) { fields.push('username = ?'); values.push(updates.username); }
      if (updates.bundlePath !== undefined) { fields.push('bundle_path = ?'); values.push(updates.bundlePath); }
      if (updates.password !== undefined) { fields.push('password = ?'); values.push(updates.password); }
      if (updates.passphrase !== undefined) { fields.push('passphrase = ?'); values.push(updates.passphrase); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE app_sync_accounts SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE app_sync_accounts SET deleted_at = ?, updated_at = ? WHERE id = ?',
        [now, now, id]
      );
    },
  };
}
