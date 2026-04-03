import { create } from 'zustand';
import type { ProviderAccount, ProviderMap, Task } from '@/types';
import type { DatabaseAdapter } from '@/db/repository';
import {
  createProviderAccountRepository,
  createProviderMapRepository,
  createTaskRepository,
} from '@/db/repository';
import { generateId } from '@/lib/utils';
import { providerTestConnection, providerDiscoverCalendars, providerSync } from '@/providers/ipc';
import type { ProviderCalendar, TaskPushInput, EventPushInput } from '@/providers/types';
import { useEventStore } from '@/stores/events';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

// Re-export so the settings view can import this type from one place.
export type { ProviderCalendar as DiscoveredCalendar };

// Internal-only result type; not a domain type.
interface SyncResult {
  accountId: string;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}

interface SyncStore {
  // ── Unified state ──────────────────────────────────────────────────────────
  accounts: ProviderAccount[];
  maps: ProviderMap[];

  // ── Sync status ────────────────────────────────────────────────────────────
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  lastSyncAt: string | null;
  isSyncing: boolean;

  // ── Account actions ────────────────────────────────────────────────────────
  loadAccounts: (adapter: DatabaseAdapter) => Promise<void>;
  addAccount: (
    adapter: DatabaseAdapter,
    providerType: string,
    displayName: string,
    credentials: Record<string, unknown>,
  ) => Promise<ProviderAccount>;
  updateAccount: (
    adapter: DatabaseAdapter,
    id: string,
    updates: Partial<ProviderAccount>,
  ) => Promise<void>;
  deleteAccount: (adapter: DatabaseAdapter, id: string) => Promise<void>;

  // ── Discovery actions ──────────────────────────────────────────────────────
  testConnection: (
    providerType: string,
    credentials: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>;
  discoverSources: (
    providerType: string,
    credentials: Record<string, unknown>,
  ) => Promise<ProviderCalendar[]>;

  // ── Map (source linking) actions ───────────────────────────────────────────
  linkSource: (
    adapter: DatabaseAdapter,
    accountId: string,
    sourceId: string,
    sourceName: string | null,
    listId: string | null,
    settings: Record<string, unknown>,
  ) => Promise<void>;
  unlinkSource: (adapter: DatabaseAdapter, mapId: string) => Promise<void>;
  updateMap: (
    adapter: DatabaseAdapter,
    mapId: string,
    settings: Record<string, unknown>,
  ) => Promise<void>;

  // ── Sync actions ───────────────────────────────────────────────────────────
  syncAccount: (
    adapter: DatabaseAdapter,
    accountId: string,
    tasks: Task[],
    onTasksChanged: () => Promise<void>,
    onListsChanged: () => Promise<void>,
  ) => Promise<SyncResult>;
  syncAll: (
    adapter: DatabaseAdapter,
    tasks: Task[],
    lists: unknown[],
    onTasksChanged: () => Promise<void>,
    onListsChanged: () => Promise<void>,
  ) => Promise<void>;
  syncPending: (
    adapter: DatabaseAdapter,
    pendingListIds: Set<string | null>,
    tasks: Task[],
    lists: unknown[],
    onTasksChanged: () => Promise<void>,
    onListsChanged: () => Promise<void>,
  ) => Promise<void>;
}

export const useSyncStore = create<SyncStore>()((set, get) => ({
  accounts: [],
  maps: [],
  syncStatus: 'idle',
  lastSyncError: null,
  lastSyncAt: null,
  isSyncing: false,

  // ── Account actions ────────────────────────────────────────────────────────

  async loadAccounts(adapter) {
    const accountRepo = createProviderAccountRepository(adapter);
    const mapRepo = createProviderMapRepository(adapter);
    const [accounts, maps] = await Promise.all([accountRepo.getAll(), mapRepo.getAll()]);
    set({ accounts, maps });
  },

  async addAccount(adapter, providerType, displayName, credentials) {
    const accountRepo = createProviderAccountRepository(adapter);
    const now = new Date().toISOString();
    const account: ProviderAccount = {
      id: generateId(),
      providerType,
      displayName,
      credentials,
      lastSyncedAt: null,
      syncEnabled: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await accountRepo.create(account);
    set((state) => ({ accounts: [...state.accounts, account] }));
    return account;
  },

  async updateAccount(adapter, id, updates) {
    const accountRepo = createProviderAccountRepository(adapter);
    await accountRepo.update(id, updates);
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      ),
    }));
  },

  async deleteAccount(adapter, id) {
    const accountRepo = createProviderAccountRepository(adapter);
    // Cascade: repository.delete() also deletes provider_maps for this account.
    await accountRepo.delete(id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
      maps: state.maps.filter((m) => m.accountId !== id),
    }));
  },

  // ── Discovery ──────────────────────────────────────────────────────────────

  async testConnection(providerType, credentials) {
    return providerTestConnection(providerType, credentials);
  },

  async discoverSources(providerType, credentials) {
    return providerDiscoverCalendars(providerType, credentials);
  },

  // ── Map (source linking) actions ───────────────────────────────────────────

  async linkSource(adapter, accountId, sourceId, sourceName, listId, settings) {
    const mapRepo = createProviderMapRepository(adapter);
    const now = new Date().toISOString();
    // Check if a map already exists for this account+source combination.
    const existing = get().maps.find(
      (m) => m.accountId === accountId && m.sourceId === sourceId
    );
    if (existing) {
      // Update the existing map.
      await mapRepo.update(existing.id, { listId, sourceName, settings });
      set((state) => ({
        maps: state.maps.map((m) =>
          m.id === existing.id
            ? { ...m, listId, sourceName, settings, updatedAt: new Date().toISOString() }
            : m
        ),
      }));
      return;
    }
    const map: ProviderMap = {
      id: generateId(),
      accountId,
      listId,
      sourceId,
      sourceName,
      settings,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await mapRepo.create(map);
    set((state) => ({ maps: [...state.maps, map] }));
  },

  async unlinkSource(adapter, mapId) {
    const mapRepo = createProviderMapRepository(adapter);
    await mapRepo.delete(mapId);
    set((state) => ({ maps: state.maps.filter((m) => m.id !== mapId) }));
  },

  async updateMap(adapter, mapId, settings) {
    const mapRepo = createProviderMapRepository(adapter);
    await mapRepo.update(mapId, { settings });
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? { ...m, settings, updatedAt: new Date().toISOString() }
          : m
      ),
    }));
  },

  // ── Unified syncAccount ────────────────────────────────────────────────────

  async syncAccount(adapter, accountId, tasks, onTasksChanged, _onListsChanged) {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account || !account.syncEnabled) {
      return { accountId, created: 0, updated: 0, deleted: 0, conflicts: 0, errors: [] };
    }

    const maps = get().maps.filter((m) => m.accountId === accountId && m.listId !== null);
    const taskRepo = createTaskRepository(adapter);
    const accountRepo = createProviderAccountRepository(adapter);

    const result: SyncResult = {
      accountId,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
    };

    // VEVENT-backed invariant: sourceEventUid === remoteId (both non-null).
    // These must NOT be pushed as VTODOs; they are handled in the separate VEVENT pass below.
    const isVEventBacked = (t: Task) =>
      t.sourceEventUid !== null && t.sourceEventUid === t.remoteId;

    // ── VTODO map loop ────────────────────────────────────────────────────────
    for (const map of maps) {
      // Events-only sources (CalDAV) have no task sync.
      if (map.settings.events_only === true) continue;

      const config: Record<string, unknown> = {
        ...account.credentials,
        ...map.settings,
      };

      const listTasks = tasks.filter((t) => t.listId === map.listId);

      const pendingTasks = listTasks.filter(
        (t) => t.syncStatus === 'pending' && t.parentId === null && !isVEventBacked(t)
      );

      // Build VTODO push inputs only (no event params here)
      const pushInputs: TaskPushInput[] = pendingTasks.map((t) => ({
        localId: t.id,
        remoteId: t.remoteId ?? null,
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
        const syncResult = await providerSync(
          account.providerType,
          config,
          map.sourceId,
          pushInputs,
          [],
          [],
          [],
        );

        const justPushedIds = new Set<string>();

        for (const pushed of syncResult.pushed) {
          await taskRepo.update(pushed.localId, {
            remoteId: pushed.remoteId,
            etag: pushed.etag || null,
            syncStatus: 'synced',
          });
          justPushedIds.add(pushed.remoteId);
          result.updated++;
        }

        result.errors.push(...syncResult.pushErrors, ...syncResult.deleteErrors);

        for (const remote of syncResult.remoteTasks) {
          if (justPushedIds.has(remote.remoteId)) continue;

          const existingTask = listTasks.find((t) => t.remoteId === remote.remoteId);

          if (existingTask) {
            if (existingTask.syncStatus === 'pending') { result.conflicts++; continue; }
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
              deletedAt: null,
              timeEstimate: remote.timeEstimate ?? null,
              timeSpent: 0,
              notes: remote.notes ?? '',
              etag: remote.etag,
              remoteId: remote.remoteId,
              syncStatus: 'synced',
              sourceEventUid: remote.sourceEventUid ?? null,
            };
            await taskRepo.create(newTask);
            result.created++;
          }
        }

        if (syncResult.fetchError) result.errors.push(syncResult.fetchError);
      } catch (e) {
        result.errors.push(`${account.providerType} ${map.sourceId}: ${String(e)}`);
      }
    }

    // ── VEVENT-backed task sync (separate pass per source calendar) ───────────
    // VEVENTs live in events-only CalDAV calendars, not in the VTODO calendar
    // addressed by map.sourceId. We look up each task's calendarHref from the
    // event store and group tasks by that href.
    {
      const { events: storedCalEvents } = useEventStore.getState();

      // Build uid → calendarHref from the in-memory event store
      const uidToCalHref = new Map<string, string>();
      for (const [, ev] of storedCalEvents) {
        uidToCalHref.set(ev.uid, ev.calendarHref);
      }

      // All sourceIds that belong to this account (used to filter out foreign calendars)
      const allAccountSourceIds = new Set(
        get().maps.filter((m) => m.accountId === accountId).map((m) => m.sourceId)
      );

      // Group VEVENT-backed tasks by their calendarHref
      const veventsByCalendar = new Map<string, { pending: EventPushInput[]; watched: string[] }>();
      for (const t of tasks) {
        if (!isVEventBacked(t)) continue;
        const calHref = uidToCalHref.get(t.remoteId!);
        if (!calHref || !allAccountSourceIds.has(calHref)) continue;

        if (!veventsByCalendar.has(calHref)) {
          veventsByCalendar.set(calHref, { pending: [], watched: [] });
        }
        const entry = veventsByCalendar.get(calHref)!;
        entry.watched.push(t.remoteId!);

        if (t.syncStatus === 'pending') {
          const dtstart = t.dueDate ?? null;
          let dtend: string | null = null;
          if (dtstart && t.timeEstimate) {
            dtend = new Date(new Date(dtstart).getTime() + t.timeEstimate * 60_000).toISOString();
          }
          entry.pending.push({
            localId: t.id,
            eventUid: t.remoteId!,
            title: t.title,
            description: t.description || null,
            dtstart,
            dtend,
            tags: t.tags,
            notes: t.notes || null,
            timeEstimate: t.timeEstimate ?? null,
            completed: t.completed,
            priority: t.priority,
            etag: t.etag ?? '',
          });
        }
      }

      for (const [calHref, { pending, watched }] of veventsByCalendar) {
        try {
          const evConfig: Record<string, unknown> = { ...account.credentials };
          const evResult = await providerSync(
            account.providerType,
            evConfig,
            calHref,
            [],
            [],
            pending,
            watched,
          );

          for (const pushed of evResult.eventPushed) {
            await taskRepo.update(pushed.localId, {
              etag: pushed.etag || null,
              syncStatus: 'synced',
            });
            result.updated++;
          }
          result.errors.push(...evResult.eventPushErrors);

          for (const remote of evResult.remoteEvents) {
            const existingTask = tasks.find(
              (t) => t.remoteId === remote.remoteId && isVEventBacked(t)
            );
            if (!existingTask) continue;
            if (existingTask.syncStatus === 'pending') { result.conflicts++; continue; }
            if (existingTask.etag && existingTask.etag === remote.etag) continue;

            const dueDate = remote.start ?? null;
            let timeEstimate: number | null = null;
            if (remote.start && remote.end) {
              const mins = Math.round(
                (new Date(remote.end).getTime() - new Date(remote.start).getTime()) / 60_000
              );
              timeEstimate = mins > 0 ? mins : null;
            }

            await taskRepo.update(existingTask.id, {
              title: remote.title,
              description: remote.description ?? '',
              dueDate,
              timeEstimate,
              etag: remote.etag,
              syncStatus: 'synced',
            });
            result.updated++;
          }
        } catch (e) {
          result.errors.push(`${account.providerType} ${calHref}: ${String(e)}`);
        }
      }
    }

    await accountRepo.setLastSynced(accountId, new Date().toISOString());
    await onTasksChanged();
    return result;
  },

  // ── syncAll (unified) ──────────────────────────────────────────────────────

  async syncAll(adapter, tasks, _lists, onTasksChanged, onListsChanged) {
    if (get().isSyncing) return;

    set({ isSyncing: true, syncStatus: 'syncing', lastSyncError: null });
    const errors: string[] = [];

    for (const account of get().accounts.filter((a) => a.syncEnabled)) {
      try {
        const result = await get().syncAccount(adapter, account.id, tasks, onTasksChanged, onListsChanged);
        errors.push(...result.errors);
      } catch (e) {
        errors.push(`${account.providerType} ${account.displayName}: ${String(e)}`);
      }
    }

    set({
      isSyncing: false,
      syncStatus: errors.length > 0 ? 'error' : 'success',
      lastSyncError: errors.length > 0 ? errors.join('; ') : null,
      lastSyncAt: new Date().toISOString(),
    });

    await get().loadAccounts(adapter);
  },

  // ── syncPending (targeted) ─────────────────────────────────────────────────

  async syncPending(adapter, pendingListIds, tasks, _lists, onTasksChanged, onListsChanged) {
    if (get().isSyncing) return;

    // Resolve which accounts are touched by the pending list IDs.
    const accountIds = new Set<string>();
    for (const listId of pendingListIds) {
      if (!listId) continue; // Inbox tasks are local-only
      const map = get().maps.find((m) => m.listId === listId);
      if (map) accountIds.add(map.accountId);
    }

    if (accountIds.size === 0) return;

    set({ isSyncing: true, syncStatus: 'syncing', lastSyncError: null });
    const errors: string[] = [];

    for (const account of get().accounts.filter((a) => a.syncEnabled && accountIds.has(a.id))) {
      try {
        const result = await get().syncAccount(adapter, account.id, tasks, onTasksChanged, onListsChanged);
        errors.push(...result.errors);
      } catch (e) {
        errors.push(`${account.providerType} ${account.displayName}: ${String(e)}`);
      }
    }

    set({
      isSyncing: false,
      syncStatus: errors.length > 0 ? 'error' : 'success',
      lastSyncError: errors.length > 0 ? errors.join('; ') : null,
      lastSyncAt: new Date().toISOString(),
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
