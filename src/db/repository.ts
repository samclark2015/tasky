import type { Task, TaskList, NewTask, NewTaskList, CalDavAccount, CalDavCalendarMap, GitHubAccount, GitHubRepoMap } from '@/types';

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
    timeEstimate: (row.time_estimate as number | null) ?? null,
    timeSpent: (row.time_spent as number) ?? 0,
    notes: (row.notes as string) ?? '',
    etag: (row.etag as string | null) ?? null,
    caldavUid: (row.caldav_uid as string | null) ?? null,
    syncStatus: (row.sync_status as Task['syncStatus']) ?? 'pending',
    sourceEventUid: (row.source_event_uid as string | null) ?? null,
  };
}

function rowToList(row: Record<string, unknown>): TaskList {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
    caldavUrl: (row.caldav_url as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createTaskRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<Task[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks ORDER BY created_at DESC'
      );
      return rows.map(rowToTask);
    },

    async getById(id: string): Promise<Task | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rowToTask(rows[0]) : null;
    },

    async getByList(listId: string): Promise<Task[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE list_id = ? ORDER BY created_at DESC',
        [listId]
      );
      return rows.map(rowToTask);
    },

    async getDueToday(): Promise<Task[]> {
      const today = new Date().toISOString().split('T')[0];
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM tasks WHERE date(due_date) = ? AND completed = 0 ORDER BY due_date ASC",
        [today]
      );
      return rows.map(rowToTask);
    },

    async getInbox(): Promise<Task[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE list_id IS NULL AND completed = 0 ORDER BY created_at DESC'
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
          etag, caldav_uid, sync_status, source_event_uid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          task.caldavUid ?? null,
          'pending',
          task.sourceEventUid ?? null,
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
      if (updates.listId !== undefined) { fields.push('list_id = ?'); values.push(updates.listId || null); }
      if (updates.parentId !== undefined) { fields.push('parent_id = ?'); values.push(updates.parentId); }
      if (updates.sourceEventUid !== undefined) { fields.push('source_event_uid = ?'); values.push(updates.sourceEventUid); }

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
      await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
    },
  };
}

export function createListRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<TaskList[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM lists ORDER BY name ASC'
      );
      return rows.map(rowToList);
    },

    async getById(id: string): Promise<TaskList | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM lists WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rowToList(rows[0]) : null;
    },

    async create(list: NewTaskList & { id: string }): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        'INSERT INTO lists (id, name, color, caldav_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [list.id, list.name, list.color ?? null, list.caldavUrl ?? null, now, now]
      );
    },

    async update(id: string, updates: Partial<TaskList>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
      if (updates.caldavUrl !== undefined) { fields.push('caldav_url = ?'); values.push(updates.caldavUrl); }

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
      await db.execute('DELETE FROM lists WHERE id = ?', [id]);
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

function rowToAccount(row: Record<string, unknown>): CalDavAccount {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    serverUrl: row.server_url as string,
    username: row.username as string,
    password: row.password as string,
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    syncEnabled: Boolean(row.sync_enabled),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCalendarMap(row: Record<string, unknown>): CalDavCalendarMap {
  return {
    listId: row.list_id as string,
    accountId: row.account_id as string,
    calendarHref: row.calendar_href as string,
    syncToken: (row.sync_token as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createAccountRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<CalDavAccount[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM caldav_accounts ORDER BY display_name ASC'
      );
      return rows.map(rowToAccount);
    },

    async getById(id: string): Promise<CalDavAccount | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM caldav_accounts WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rowToAccount(rows[0]) : null;
    },

    async create(account: CalDavAccount): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO caldav_accounts
         (id, display_name, server_url, username, password, last_synced_at, sync_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.id,
          account.displayName,
          account.serverUrl,
          account.username,
          account.password,
          account.lastSyncedAt ?? null,
          account.syncEnabled ? 1 : 0,
          now,
          now,
        ]
      );
    },

    async update(id: string, updates: Partial<CalDavAccount>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.displayName !== undefined) { fields.push('display_name = ?'); values.push(updates.displayName); }
      if (updates.serverUrl !== undefined) { fields.push('server_url = ?'); values.push(updates.serverUrl); }
      if (updates.username !== undefined) { fields.push('username = ?'); values.push(updates.username); }
      if (updates.password !== undefined) { fields.push('password = ?'); values.push(updates.password); }
      if (updates.lastSyncedAt !== undefined) { fields.push('last_synced_at = ?'); values.push(updates.lastSyncedAt); }
      if (updates.syncEnabled !== undefined) { fields.push('sync_enabled = ?'); values.push(updates.syncEnabled ? 1 : 0); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE caldav_accounts SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      await db.execute('DELETE FROM caldav_accounts WHERE id = ?', [id]);
    },

    async setLastSynced(id: string, at: string): Promise<void> {
      await db.execute(
        'UPDATE caldav_accounts SET last_synced_at = ?, updated_at = ? WHERE id = ?',
        [at, at, id]
      );
    },
  };
}

export function createCalendarMapRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<CalDavCalendarMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM caldav_calendar_map'
      );
      return rows.map(rowToCalendarMap);
    },

    async getByAccount(accountId: string): Promise<CalDavCalendarMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM caldav_calendar_map WHERE account_id = ?',
        [accountId]
      );
      return rows.map(rowToCalendarMap);
    },

    async getByList(listId: string): Promise<CalDavCalendarMap | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM caldav_calendar_map WHERE list_id = ?',
        [listId]
      );
      return rows.length > 0 ? rowToCalendarMap(rows[0]) : null;
    },

    async upsert(map: CalDavCalendarMap): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO caldav_calendar_map
         (list_id, account_id, calendar_href, sync_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [map.listId, map.accountId, map.calendarHref, map.syncToken ?? null, now, now]
      );
    },

    async updateSyncToken(listId: string, syncToken: string): Promise<void> {
      await db.execute(
        'UPDATE caldav_calendar_map SET sync_token = ?, updated_at = ? WHERE list_id = ?',
        [syncToken, new Date().toISOString(), listId]
      );
    },

    async delete(listId: string): Promise<void> {
      await db.execute('DELETE FROM caldav_calendar_map WHERE list_id = ?', [listId]);
    },
  };
}

// ── GitHub ────────────────────────────────────────────────────────────────────

function rowToGitHubAccount(row: Record<string, unknown>): GitHubAccount {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    token: row.token as string,
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    syncEnabled: Boolean(row.sync_enabled),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToGitHubRepoMap(row: Record<string, unknown>): GitHubRepoMap {
  return {
    listId: row.list_id as string,
    accountId: row.account_id as string,
    repoFullName: row.repo_full_name as string,
    query: (row.query as string | null) ?? null,
    readOnly: Boolean(row.read_only),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createGitHubAccountRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<GitHubAccount[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM github_accounts ORDER BY display_name ASC'
      );
      return rows.map(rowToGitHubAccount);
    },

    async getById(id: string): Promise<GitHubAccount | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM github_accounts WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rowToGitHubAccount(rows[0]) : null;
    },

    async create(account: GitHubAccount): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO github_accounts
         (id, display_name, token, last_synced_at, sync_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          account.id,
          account.displayName,
          account.token,
          account.lastSyncedAt ?? null,
          account.syncEnabled ? 1 : 0,
          now,
          now,
        ]
      );
    },

    async update(id: string, updates: Partial<GitHubAccount>): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.displayName !== undefined) { fields.push('display_name = ?'); values.push(updates.displayName); }
      if (updates.token !== undefined) { fields.push('token = ?'); values.push(updates.token); }
      if (updates.lastSyncedAt !== undefined) { fields.push('last_synced_at = ?'); values.push(updates.lastSyncedAt); }
      if (updates.syncEnabled !== undefined) { fields.push('sync_enabled = ?'); values.push(updates.syncEnabled ? 1 : 0); }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await db.execute(
        `UPDATE github_accounts SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    },

    async delete(id: string): Promise<void> {
      await db.execute('DELETE FROM github_accounts WHERE id = ?', [id]);
    },

    async setLastSynced(id: string, at: string): Promise<void> {
      await db.execute(
        'UPDATE github_accounts SET last_synced_at = ?, updated_at = ? WHERE id = ?',
        [at, at, id]
      );
    },
  };
}

export function createGitHubRepoMapRepository(db: DatabaseAdapter) {
  return {
    async getAll(): Promise<GitHubRepoMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM github_repo_map'
      );
      return rows.map(rowToGitHubRepoMap);
    },

    async getByAccount(accountId: string): Promise<GitHubRepoMap[]> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM github_repo_map WHERE account_id = ?',
        [accountId]
      );
      return rows.map(rowToGitHubRepoMap);
    },

    async getByList(listId: string): Promise<GitHubRepoMap | null> {
      const rows = await db.select<Record<string, unknown>>(
        'SELECT * FROM github_repo_map WHERE list_id = ?',
        [listId]
      );
      return rows.length > 0 ? rowToGitHubRepoMap(rows[0]) : null;
    },

    async upsert(map: GitHubRepoMap): Promise<void> {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO github_repo_map
         (list_id, account_id, repo_full_name, query, read_only, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          map.listId,
          map.accountId,
          map.repoFullName,
          map.query ?? null,
          map.readOnly ? 1 : 0,
          now,
          now,
        ]
      );
    },

    async update(listId: string, updates: { query?: string | null; readOnly?: boolean }): Promise<void> {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];

      if ('query' in updates) { fields.push('query = ?'); values.push(updates.query ?? null); }
      if ('readOnly' in updates) {
        fields.push('read_only = ?');
        values.push(updates.readOnly ? 1 : 0);
      }

      if (fields.length === 0) return;

      fields.push('updated_at = ?');
      values.push(now);
      values.push(listId);

      await db.execute(
        `UPDATE github_repo_map SET ${fields.join(', ')} WHERE list_id = ?`,
        values
      );
    },

    async delete(listId: string): Promise<void> {
      await db.execute('DELETE FROM github_repo_map WHERE list_id = ?', [listId]);
    },
  };
}
