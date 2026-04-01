import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  CalDavAccount,
  CalDavCalendarMap,
  DiscoveredCalendar,
  SyncResult,
  Task,
  TaskList,
} from '@tasky/core';
import type { DatabaseAdapter } from '@db/repository';
import {
  createAccountRepository,
  createCalendarMapRepository,
  createTaskRepository,
} from '@db/repository';
import { generateId } from '@/lib/utils';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

interface SyncStore {
  accounts: CalDavAccount[];
  calendarMaps: CalDavCalendarMap[];
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  lastSyncAt: string | null;
  isSyncing: boolean;

  loadAccounts: (adapter: DatabaseAdapter) => Promise<void>;
  addAccount: (adapter: DatabaseAdapter, account: Omit<CalDavAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>) => Promise<CalDavAccount>;
  updateAccount: (adapter: DatabaseAdapter, id: string, updates: Partial<CalDavAccount>) => Promise<void>;
  deleteAccount: (adapter: DatabaseAdapter, id: string) => Promise<void>;
  testConnection: (serverUrl: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  discoverCalendars: (serverUrl: string, username: string, password: string) => Promise<DiscoveredCalendar[]>;
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
  syncStatus: 'idle',
  lastSyncError: null,
  lastSyncAt: null,
  isSyncing: false,

  async loadAccounts(adapter) {
    const accountRepo = createAccountRepository(adapter);
    const mapRepo = createCalendarMapRepository(adapter);
    const [accounts, calendarMaps] = await Promise.all([
      accountRepo.getAll(),
      mapRepo.getAll(),
    ]);
    set({ accounts, calendarMaps });
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
    try {
      const result = await invoke<{ ok: boolean; principal: string | null; error: string | null }>(
        'caldav_test_connection',
        { serverUrl, username, password }
      );
      return { ok: result.ok, error: result.error ?? undefined };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  async discoverCalendars(serverUrl, username, password) {
    const result = await invoke<{ calendars: DiscoveredCalendar[]; error: string | null }>(
      'caldav_discover_calendars',
      { serverUrl, username, password }
    );
    return result.calendars;
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

      const pendingTasksInput = pendingTasks.map((t) => ({
        id: t.id,
        list_id: t.listId,
        parent_id: t.parentId,
        title: t.title,
        description: t.description,
        due_date: t.dueDate,
        priority: t.priority,
        tags: t.tags,
        recurrence_rrule: t.recurrence
          ? rruleToString(t.recurrence)
          : null,
        completed: t.completed,
        completed_at: t.completedAt,
        notes: t.notes,
        time_estimate: t.timeEstimate,
        etag: t.etag,
        caldav_uid: t.caldavUid,
        sync_status: t.syncStatus,
        updated_at: t.updatedAt,
      }));

      try {
        const syncResult = await invoke<{
          pushed: Array<{ id: string; caldav_uid: string; etag: string; href: string }>;
          push_errors: string[];
          delete_errors: string[];
          remote_tasks: Array<{
            href: string;
            etag: string;
            vtodo: {
              uid: string;
              summary: string;
              description: string | null;
              due: string | null;
              priority: number | null;
              categories: string[];
              status: string | null;
              completed: boolean;
              completed_at: string | null;
              rrule: string | null;
              related_to: string | null;
              notes: string | null;
              time_estimate: number | null;
            };
          }>;
          fetch_error?: string;
        }>('caldav_sync_account', {
          serverUrl: account.serverUrl,
          username: account.username,
          password: account.password,
          calendarHref: map.calendarHref,
          pendingTasks: pendingTasksInput,
          deletedHrefs: [],
        });

        // Track which local task IDs were just pushed so we don't overwrite them
        // with the remote echo returned in the same sync round-trip.
        const justPushedUids = new Set<string>();

        for (const pushed of syncResult.pushed) {
          await taskRepo.update(pushed.id, {
            caldavUid: pushed.caldav_uid,
            etag: pushed.etag,
            syncStatus: 'synced',
          });
          justPushedUids.add(pushed.caldav_uid);
          result.updated++;
        }

        result.errors.push(...syncResult.push_errors, ...syncResult.delete_errors);

        // Apply remote changes. Local always wins when there are pending edits.
        for (const remote of syncResult.remote_tasks) {
          const { vtodo } = remote;
          const existingTask = calendarTasks.find(
            (t) => t.caldavUid === vtodo.uid
          );

          if (existingTask) {
            // Local has unpushed edits — skip; we own this version.
            if (existingTask.syncStatus === 'pending') {
              result.conflicts++;
              continue;
            }

            // We just pushed this task in this very sync run — skip the echo.
            if (justPushedUids.has(vtodo.uid)) {
              continue;
            }

            // Remote ETag matches what we already have — nothing changed.
            if (existingTask.etag && existingTask.etag === remote.etag) {
              continue;
            }

            const updates: Partial<Task> = {
              title: vtodo.summary,
              description: vtodo.description ?? '',
              dueDate: vtodo.due ?? null,
              priority: priorityNumToStr(vtodo.priority),
              tags: vtodo.categories,
              completed: vtodo.completed,
              completedAt: vtodo.completed_at ?? null,
              notes: vtodo.notes ?? '',
              timeEstimate: vtodo.time_estimate ?? null,
              etag: remote.etag,
              syncStatus: 'synced',
            };

            if (vtodo.rrule) {
              updates.recurrence = parseRRule(vtodo.rrule);
            }

            await taskRepo.update(existingTask.id, updates);
            result.updated++;
          } else {
            // New remote task
            const now = new Date().toISOString();
            const newId = generateId();
            const newTask: Task = {
              id: newId,
              listId: map.listId,
              parentId: null,
              title: vtodo.summary,
              description: vtodo.description ?? '',
              dueDate: vtodo.due ?? null,
              priority: priorityNumToStr(vtodo.priority),
              tags: vtodo.categories,
              recurrence: vtodo.rrule ? parseRRule(vtodo.rrule) : null,
              completed: vtodo.completed,
              completedAt: vtodo.completed_at ?? null,
              createdAt: now,
              updatedAt: now,
              timeEstimate: vtodo.time_estimate ?? null,
              timeSpent: 0,
              notes: vtodo.notes ?? '',
              etag: remote.etag,
              caldavUid: vtodo.uid,
              syncStatus: 'synced',
            };
            await taskRepo.create(newTask);
            result.created++;
          }
        }

        if (syncResult.fetch_error) {
          result.errors.push(syncResult.fetch_error);
        }
      } catch (e) {
        result.errors.push(`Calendar ${map.calendarHref}: ${String(e)}`);
      }
    }

    await accountRepo.setLastSynced(accountId, new Date().toISOString());
    await onTasksChanged();

    return result;
  },

  async syncAll(adapter, tasks, lists, onTasksChanged, onListsChanged) {
    const { accounts, isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, syncStatus: 'syncing', lastSyncError: null });

    const errors: string[] = [];

    for (const account of accounts.filter((a) => a.syncEnabled)) {
      try {
        const result = await get().syncAccount(
          adapter,
          account.id,
          tasks,
          lists,
          onTasksChanged,
          onListsChanged
        );
        errors.push(...result.errors);
      } catch (e) {
        errors.push(`Account ${account.displayName}: ${String(e)}`);
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
    rrule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );

  const freq = (parts['FREQ'] ?? 'daily').toLowerCase() as Task['recurrence'] extends null ? never : NonNullable<Task['recurrence']>['freq'];

  return {
    freq,
    interval: parts['INTERVAL'] ? Number(parts['INTERVAL']) : undefined,
    until: parts['UNTIL'],
    count: parts['COUNT'] ? Number(parts['COUNT']) : undefined,
    byDay: parts['BYDAY']?.split(','),
    byMonthDay: parts['BYMONTHDAY']?.split(',').map(Number),
  };
}
