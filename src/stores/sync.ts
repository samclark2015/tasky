import { create } from 'zustand';
import type {
  CalDavAccount,
  CalDavCalendarMap,
  GitHubAccount,
  GitHubRepoMap,
  SyncResult,
  Task,
  TaskList,
} from '@/types';
import type { DatabaseAdapter } from '@/db/repository';
import {
  createAccountRepository,
  createCalendarMapRepository,
  createGitHubAccountRepository,
  createGitHubRepoMapRepository,
  createTaskRepository,
} from '@/db/repository';
import { generateId } from '@/lib/utils';
import {
  providerTestConnection,
  providerDiscoverCalendars,
  providerSync,
} from '@/providers/ipc';
import type { ProviderCalendar, TaskPushInput } from '@/providers/types';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

// Re-export so the settings view can import this type from one place.
export type { ProviderCalendar as DiscoveredCalendar };

interface SyncStore {
  // ── CalDAV state ────────────────────────────────────────────────────────────
  accounts: CalDavAccount[];
  calendarMaps: CalDavCalendarMap[];

  // ── GitHub state ────────────────────────────────────────────────────────────
  githubAccounts: GitHubAccount[];
  githubRepoMaps: GitHubRepoMap[];

  // ── Shared sync status ──────────────────────────────────────────────────────
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  lastSyncAt: string | null;
  isSyncing: boolean;

  // ── CalDAV actions ──────────────────────────────────────────────────────────
  loadAccounts: (adapter: DatabaseAdapter) => Promise<void>;
  addAccount: (
    adapter: DatabaseAdapter,
    account: Omit<CalDavAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>
  ) => Promise<CalDavAccount>;
  updateAccount: (adapter: DatabaseAdapter, id: string, updates: Partial<CalDavAccount>) => Promise<void>;
  deleteAccount: (adapter: DatabaseAdapter, id: string) => Promise<void>;
  testConnection: (serverUrl: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  discoverCalendars: (serverUrl: string, username: string, password: string) => Promise<ProviderCalendar[]>;
  linkCalendar: (adapter: DatabaseAdapter, accountId: string, calendarHref: string, list: TaskList) => Promise<void>;
  unlinkCalendar: (adapter: DatabaseAdapter, listId: string) => Promise<void>;
  syncAccount: (
    adapter: DatabaseAdapter,
    accountId: string,
    tasks: Task[],
    lists: TaskList[],
    onTasksChanged: () => Promise<void>,
    onListsChanged: () => Promise<void>,
  ) => Promise<SyncResult>;

  // ── GitHub actions ──────────────────────────────────────────────────────────
  addGitHubAccount: (
    adapter: DatabaseAdapter,
    account: Omit<GitHubAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>
  ) => Promise<GitHubAccount>;
  updateGitHubAccount: (adapter: DatabaseAdapter, id: string, updates: Partial<GitHubAccount>) => Promise<void>;
  deleteGitHubAccount: (adapter: DatabaseAdapter, id: string) => Promise<void>;
  testGitHubConnection: (token: string) => Promise<{ ok: boolean; error?: string }>;
  discoverGitHubRepos: (token: string) => Promise<ProviderCalendar[]>;
  linkGitHubRepo: (adapter: DatabaseAdapter, accountId: string, repoFullName: string, list: TaskList) => Promise<void>;
  unlinkGitHubRepo: (adapter: DatabaseAdapter, listId: string) => Promise<void>;
  updateGitHubRepoMap: (
    adapter: DatabaseAdapter,
    listId: string,
    updates: { query?: string | null; readOnly?: boolean },
  ) => Promise<void>;
  syncGitHubAccount: (
    adapter: DatabaseAdapter,
    accountId: string,
    tasks: Task[],
    onTasksChanged: () => Promise<void>,
  ) => Promise<SyncResult>;

  // ── Shared actions ──────────────────────────────────────────────────────────
  syncAll: (
    adapter: DatabaseAdapter,
    tasks: Task[],
    lists: TaskList[],
    onTasksChanged: () => Promise<void>,
    onListsChanged: () => Promise<void>,
  ) => Promise<void>;
}

export const useSyncStore = create<SyncStore>()((set, get) => ({
  accounts: [],
  calendarMaps: [],
  githubAccounts: [],
  githubRepoMaps: [],
  syncStatus: 'idle',
  lastSyncError: null,
  lastSyncAt: null,
  isSyncing: false,

  // ── CalDAV ──────────────────────────────────────────────────────────────────

  async loadAccounts(adapter) {
    const accountRepo = createAccountRepository(adapter);
    const mapRepo = createCalendarMapRepository(adapter);
    const githubAccountRepo = createGitHubAccountRepository(adapter);
    const githubRepoMapRepo = createGitHubRepoMapRepository(adapter);
    const [accounts, calendarMaps, githubAccounts, githubRepoMaps] = await Promise.all([
      accountRepo.getAll(),
      mapRepo.getAll(),
      githubAccountRepo.getAll(),
      githubRepoMapRepo.getAll(),
    ]);
    set({ accounts, calendarMaps, githubAccounts, githubRepoMaps });
  },

  async addAccount(adapter, accountData) {
    const accountRepo = createAccountRepository(adapter);
    const now = new Date().toISOString();
    const account: CalDavAccount = {
      ...accountData,
      id: generateId(),
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await accountRepo.create(account);
    set((state) => ({ accounts: [...state.accounts, account] }));
    return account;
  },

  async updateAccount(adapter, id, updates) {
    const accountRepo = createAccountRepository(adapter);
    await accountRepo.update(id, updates);
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      ),
    }));
  },

  async deleteAccount(adapter, id) {
    const accountRepo = createAccountRepository(adapter);
    const mapRepo = createCalendarMapRepository(adapter);
    const maps = await mapRepo.getByAccount(id);
    for (const map of maps) {
      await mapRepo.delete(map.listId);
    }
    await accountRepo.delete(id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
      calendarMaps: state.calendarMaps.filter((m) => m.accountId !== id),
    }));
  },

  async testConnection(serverUrl, username, password) {
    return providerTestConnection('caldav', { server_url: serverUrl, username, password });
  },

  async discoverCalendars(serverUrl, username, password) {
    return providerDiscoverCalendars('caldav', { server_url: serverUrl, username, password });
  },

  async linkCalendar(adapter, accountId, calendarHref, list) {
    const mapRepo = createCalendarMapRepository(adapter);
    const now = new Date().toISOString();
    const map: CalDavCalendarMap = {
      listId: list.id,
      accountId,
      calendarHref,
      syncToken: null,
      createdAt: now,
      updatedAt: now,
    };
    await mapRepo.upsert(map);
    set((state) => ({
      calendarMaps: [
        ...state.calendarMaps.filter((m) => m.listId !== list.id),
        map,
      ],
    }));
  },

  async unlinkCalendar(adapter, listId) {
    const mapRepo = createCalendarMapRepository(adapter);
    await mapRepo.delete(listId);
    set((state) => ({
      calendarMaps: state.calendarMaps.filter((m) => m.listId !== listId),
    }));
  },

  async syncAccount(adapter, accountId, tasks, _lists, onTasksChanged, _onListsChanged) {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account || !account.syncEnabled) {
      return { accountId, created: 0, updated: 0, deleted: 0, conflicts: 0, errors: [] };
    }

    const maps = get().calendarMaps.filter((m) => m.accountId === accountId);
    const taskRepo = createTaskRepository(adapter);
    const accountRepo = createAccountRepository(adapter);
    const config = { server_url: account.serverUrl, username: account.username, password: account.password };

    const result: SyncResult = {
      accountId,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
    };

    for (const map of maps) {
      const calendarTasks = tasks.filter((t) => t.listId === map.listId);
      const pendingTasks = calendarTasks.filter(
        (t) => t.syncStatus === 'pending' && t.parentId === null
      );

      const pushInputs: TaskPushInput[] = pendingTasks.map((t) => ({
        localId: t.id,
        remoteId: t.caldavUid ?? null,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        priority: t.priority,
        tags: t.tags,
        rrule: t.recurrence ? rruleToString(t.recurrence) : null,
        completed: t.completed,
        completedAt: t.completedAt,
        notes: t.notes,
        timeEstimate: t.timeEstimate,
        etag: t.etag,
        href: null,
        parentRemoteId: t.parentId,
        sourceEventUid: t.sourceEventUid,
      }));

      try {
        const syncResult = await providerSync('caldav', config, map.calendarHref, pushInputs, []);

        const justPushedUids = new Set<string>();

        for (const pushed of syncResult.pushed) {
          await taskRepo.update(pushed.localId, {
            caldavUid: pushed.remoteId,
            etag: pushed.etag,
            syncStatus: 'synced',
          });
          justPushedUids.add(pushed.remoteId);
          result.updated++;
        }

        result.errors.push(...syncResult.pushErrors, ...syncResult.deleteErrors);

        for (const remote of syncResult.remoteTasks) {
          const existingTask = calendarTasks.find((t) => t.caldavUid === remote.remoteId);

          if (existingTask) {
            if (existingTask.syncStatus === 'pending') { result.conflicts++; continue; }
            if (justPushedUids.has(remote.remoteId)) continue;
            if (existingTask.etag && existingTask.etag === remote.etag) continue;

            const updates: Partial<Task> = {
              title: remote.title,
              description: remote.description ?? '',
              dueDate: remote.dueDate ?? null,
              priority: priorityNumToStr(remote.priority),
              tags: remote.tags,
              completed: remote.completed,
              completedAt: remote.completedAt ?? null,
              notes: remote.notes ?? '',
              timeEstimate: remote.timeEstimate ?? null,
              etag: remote.etag,
              syncStatus: 'synced',
            };
            if (remote.rrule) updates.recurrence = parseRRule(remote.rrule);
            await taskRepo.update(existingTask.id, updates);
            result.updated++;
          } else {
            const now = new Date().toISOString();
            const newTask: Task = {
              id: generateId(),
              listId: map.listId,
              parentId: null,
              title: remote.title,
              description: remote.description ?? '',
              dueDate: remote.dueDate ?? null,
              priority: priorityNumToStr(remote.priority),
              tags: remote.tags,
              recurrence: remote.rrule ? parseRRule(remote.rrule) : null,
              completed: remote.completed,
              completedAt: remote.completedAt ?? null,
              createdAt: now,
              updatedAt: now,
              timeEstimate: remote.timeEstimate ?? null,
              timeSpent: 0,
              notes: remote.notes ?? '',
              etag: remote.etag,
              caldavUid: remote.remoteId,
              syncStatus: 'synced',
              sourceEventUid: remote.sourceEventUid ?? null,
            };
            await taskRepo.create(newTask);
            result.created++;
          }
        }

        if (syncResult.fetchError) result.errors.push(syncResult.fetchError);
      } catch (e) {
        result.errors.push(`Calendar ${map.calendarHref}: ${String(e)}`);
      }
    }

    await accountRepo.setLastSynced(accountId, new Date().toISOString());
    await onTasksChanged();
    return result;
  },

  // ── GitHub ──────────────────────────────────────────────────────────────────

  async addGitHubAccount(adapter, accountData) {
    const repo = createGitHubAccountRepository(adapter);
    const now = new Date().toISOString();
    const account: GitHubAccount = {
      ...accountData,
      id: generateId(),
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await repo.create(account);
    set((state) => ({ githubAccounts: [...state.githubAccounts, account] }));
    return account;
  },

  async updateGitHubAccount(adapter, id, updates) {
    const repo = createGitHubAccountRepository(adapter);
    await repo.update(id, updates);
    set((state) => ({
      githubAccounts: state.githubAccounts.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      ),
    }));
  },

  async deleteGitHubAccount(adapter, id) {
    const repoMapRepo = createGitHubRepoMapRepository(adapter);
    const accountRepo = createGitHubAccountRepository(adapter);
    const maps = await repoMapRepo.getByAccount(id);
    for (const map of maps) {
      await repoMapRepo.delete(map.listId);
    }
    await accountRepo.delete(id);
    set((state) => ({
      githubAccounts: state.githubAccounts.filter((a) => a.id !== id),
      githubRepoMaps: state.githubRepoMaps.filter((m) => m.accountId !== id),
    }));
  },

  async testGitHubConnection(token) {
    return providerTestConnection('github', { token });
  },

  async discoverGitHubRepos(token) {
    return providerDiscoverCalendars('github', { token });
  },

  async linkGitHubRepo(adapter, accountId, repoFullName, list) {
    const repoMapRepo = createGitHubRepoMapRepository(adapter);
    const now = new Date().toISOString();
    const map: GitHubRepoMap = {
      listId: list.id,
      accountId,
      repoFullName,
      query: null,
      readOnly: false,
      createdAt: now,
      updatedAt: now,
    };
    await repoMapRepo.upsert(map);
    set((state) => ({
      githubRepoMaps: [
        ...state.githubRepoMaps.filter((m) => m.listId !== list.id),
        map,
      ],
    }));
  },

  async unlinkGitHubRepo(adapter, listId) {
    const repoMapRepo = createGitHubRepoMapRepository(adapter);
    await repoMapRepo.delete(listId);
    set((state) => ({
      githubRepoMaps: state.githubRepoMaps.filter((m) => m.listId !== listId),
    }));
  },

  async updateGitHubRepoMap(adapter, listId, updates) {
    const repoMapRepo = createGitHubRepoMapRepository(adapter);
    await repoMapRepo.update(listId, updates);
    set((state) => ({
      githubRepoMaps: state.githubRepoMaps.map((m) =>
        m.listId === listId ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      ),
    }));
  },

  async syncGitHubAccount(adapter, accountId, tasks, onTasksChanged) {
    const account = get().githubAccounts.find((a) => a.id === accountId);
    if (!account || !account.syncEnabled) {
      return { accountId, created: 0, updated: 0, deleted: 0, conflicts: 0, errors: [] };
    }

    const maps = get().githubRepoMaps.filter((m) => m.accountId === accountId);
    const taskRepo = createTaskRepository(adapter);
    const accountRepo = createGitHubAccountRepository(adapter);

    const result: SyncResult = {
      accountId,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
    };

    for (const map of maps) {
      const repoTasks = tasks.filter((t) => t.listId === map.listId);
      const pendingTasks = repoTasks.filter(
        // Only root tasks (no parent) are synced as top-level GitHub issues
        (t) => t.syncStatus === 'pending' && t.parentId === null
      );

      const pushInputs: TaskPushInput[] = pendingTasks.map((t) => ({
        localId: t.id,
        remoteId: t.caldavUid ?? null, // reuse caldavUid to store the GitHub issue number
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        priority: t.priority,
        tags: t.tags,
        rrule: null, // GitHub issues have no recurrence
        completed: t.completed,
        completedAt: t.completedAt,
        notes: t.notes,
        timeEstimate: t.timeEstimate,
        etag: t.etag,
        href: null,
        parentRemoteId: null,
        sourceEventUid: null,
      }));

      try {
        const config = {
          token: account.token,
          query: map.query ?? 'assignee:@me is:open',
          read_only: map.readOnly,
        };
        const syncResult = await providerSync(
          'github',
          config,
          map.repoFullName,
          pushInputs,
          [],
        );

        const justPushedIds = new Set<string>();

        for (const pushed of syncResult.pushed) {
          await taskRepo.update(pushed.localId, {
            caldavUid: pushed.remoteId, // GitHub issue number as string
            etag: pushed.etag,          // GitHub updated_at timestamp
            syncStatus: 'synced',
          });
          justPushedIds.add(pushed.remoteId);
          result.updated++;
        }

        result.errors.push(...syncResult.pushErrors, ...syncResult.deleteErrors);

        for (const remote of syncResult.remoteTasks) {
          const existingTask = repoTasks.find((t) => t.caldavUid === remote.remoteId);

          if (existingTask) {
            if (existingTask.syncStatus === 'pending') { result.conflicts++; continue; }
            if (justPushedIds.has(remote.remoteId)) continue;
            if (existingTask.etag && existingTask.etag === remote.etag) continue;

            const updates: Partial<Task> = {
              title: remote.title,
              description: remote.description ?? '',
              tags: remote.tags,
              completed: remote.completed,
              completedAt: remote.completedAt ?? null,
              etag: remote.etag,
              syncStatus: 'synced',
            };
            await taskRepo.update(existingTask.id, updates);
            result.updated++;
          } else {
            const now = new Date().toISOString();
            const newTask: Task = {
              id: generateId(),
              listId: map.listId,
              parentId: null,
              title: remote.title,
              description: remote.description ?? '',
              dueDate: null, // GitHub issues have no due date
              priority: 'medium',
              tags: remote.tags,
              recurrence: null,
              completed: remote.completed,
              completedAt: remote.completedAt ?? null,
              createdAt: now,
              updatedAt: now,
              timeEstimate: null,
              timeSpent: 0,
              notes: '',
              etag: remote.etag,
              caldavUid: remote.remoteId,
              syncStatus: 'synced',
              sourceEventUid: null,
            };
            await taskRepo.create(newTask);
            result.created++;
          }
        }

        if (syncResult.fetchError) result.errors.push(syncResult.fetchError);
      } catch (e) {
        result.errors.push(`Repo ${map.repoFullName}: ${String(e)}`);
      }
    }

    await accountRepo.setLastSynced(accountId, new Date().toISOString());
    await onTasksChanged();
    return result;
  },

  // ── syncAll (CalDAV + GitHub) ────────────────────────────────────────────────

  async syncAll(adapter, tasks, lists, onTasksChanged, onListsChanged) {
    const { accounts, githubAccounts, isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, syncStatus: 'syncing', lastSyncError: null });
    const errors: string[] = [];

    for (const account of accounts.filter((a) => a.syncEnabled)) {
      try {
        const result = await get().syncAccount(adapter, account.id, tasks, lists, onTasksChanged, onListsChanged);
        errors.push(...result.errors);
      } catch (e) {
        errors.push(`CalDAV ${account.displayName}: ${String(e)}`);
      }
    }

    for (const account of githubAccounts.filter((a) => a.syncEnabled)) {
      try {
        const result = await get().syncGitHubAccount(adapter, account.id, tasks, onTasksChanged);
        errors.push(...result.errors);
      } catch (e) {
        errors.push(`GitHub ${account.displayName}: ${String(e)}`);
      }
    }

    const now = new Date().toISOString();
    set({
      isSyncing: false,
      syncStatus: errors.length > 0 ? 'error' : 'success',
      lastSyncError: errors.length > 0 ? errors.join('; ') : null,
      lastSyncAt: now,
    });

    await get().loadAccounts(adapter);
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityNumToStr(p: number | null): Task['priority'] {
  if (!p) return 'medium';
  if (p <= 3) return 'high';
  if (p <= 6) return 'medium';
  return 'low';
}

function rruleToString(r: Task['recurrence']): string | null {
  if (!r) return null;
  const parts: string[] = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.until) parts.push(`UNTIL=${r.until.replace(/[-:]/g, '').replace('.000Z', 'Z')}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  if (r.byDay?.length) parts.push(`BYDAY=${r.byDay.join(',')}`);
  if (r.byMonthDay?.length) parts.push(`BYMONTHDAY=${r.byMonthDay.join(',')}`);
  return parts.join(';');
}

function parseRRule(rrule: string): Task['recurrence'] {
  const parts = Object.fromEntries(
    rrule.split(';').map((p) => { const [k, v] = p.split('='); return [k, v]; })
  );
  const freq = (parts['FREQ'] ?? 'daily').toLowerCase() as Task['recurrence'] extends null
    ? never : NonNullable<Task['recurrence']>['freq'];
  return {
    freq,
    interval: parts['INTERVAL'] ? Number(parts['INTERVAL']) : undefined,
    until: parts['UNTIL'],
    count: parts['COUNT'] ? Number(parts['COUNT']) : undefined,
    byDay: parts['BYDAY']?.split(','),
    byMonthDay: parts['BYMONTHDAY']?.split(',').map(Number),
  };
}
