import { useEffect, useRef } from 'react';
import type { DatabaseAdapter } from '@/db/repository';
import { useTaskStore, useListStore, useSyncStore, useUIStore } from '@/stores';
import type { Task } from '@/types';

const DEBOUNCE_DELAY_MS = 30_000; // 30 seconds after a task becomes pending

/**
 * Manages two automatic sync triggers:
 *
 * 1. Periodic sync — fires every `syncIntervalMinutes` minutes (if configured).
 *    Calls `syncAll` to refresh every connected account.
 *
 * 2. Debounced sync — fires DEBOUNCE_DELAY_MS after the pending-task set grows.
 *    Calls `syncPending` with only the list IDs that have pending tasks, so only
 *    the affected CalDAV / GitHub accounts are contacted. Local-only pending
 *    tasks (Inbox or unmapped lists) are silently skipped.
 *
 * Both triggers are no-ops when `isSyncing` is already true.
 * Must be called after the app is `ready` (adapter is non-null).
 */
export function useAutoSync(adapter: DatabaseAdapter) {
  // Stable ref to the latest adapter so interval/timeout callbacks always
  // use the current one without needing to re-register effects.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helper: full sync (used by periodic trigger) ─────────────────────────
  function triggerSync() {
    const { isSyncing, syncAll } = useSyncStore.getState();
    if (isSyncing) return;

    const { tasks } = useTaskStore.getState();
    const { lists } = useListStore.getState();
    const adp = adapterRef.current;

    syncAll(
      adp,
      Array.from(tasks.values()),
      lists,
      () => useTaskStore.getState().loadTasks(adp),
      () => useListStore.getState().loadLists(adp),
    );
  }

  // ── Helper: targeted sync for only the affected accounts ─────────────────
  function triggerSyncPending() {
    const { isSyncing, syncPending } = useSyncStore.getState();
    if (isSyncing) return;

    const { tasks } = useTaskStore.getState();
    const { lists } = useListStore.getState();
    const adp = adapterRef.current;

    const pendingListIds = new Set<string | null>();
    for (const t of tasks.values()) {
      if (t.syncStatus === 'pending') pendingListIds.add(t.listId);
    }
    if (pendingListIds.size === 0) return;

    syncPending(
      adp,
      pendingListIds,
      Array.from(tasks.values()),
      lists,
      () => useTaskStore.getState().loadTasks(adp),
      () => useListStore.getState().loadLists(adp),
    );
  }

  // ── Periodic interval sync ───────────────────────────────────────────────
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startInterval(minutes: number | null) {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      if (!minutes) return;
      intervalId = setInterval(triggerSync, minutes * 60 * 1000);
    }

    // Start with current value
    startInterval(useUIStore.getState().syncIntervalMinutes);

    // Restart whenever the setting changes
    let lastInterval = useUIStore.getState().syncIntervalMinutes;
    const unsub = useUIStore.subscribe((state) => {
      if (state.syncIntervalMinutes !== lastInterval) {
        lastInterval = state.syncIntervalMinutes;
        startInterval(state.syncIntervalMinutes);
      }
    });

    return () => {
      unsub();
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced sync on pending-task increase ──────────────────────────────
  useEffect(() => {
    /** Returns the set of listIds that have at least one pending task. */
    function getPendingListIds(tasks: Map<string, Task>): Set<string | null> {
      const ids = new Set<string | null>();
      for (const t of tasks.values()) {
        if (t.syncStatus === 'pending') ids.add(t.listId);
      }
      return ids;
    }

    const unsub = useTaskStore.subscribe(
      (state) => getPendingListIds(state.tasks),
      (ids, prev) => {
        // Only react when the pending set grows (new list IDs appeared).
        if (ids.size <= prev.size) return;

        // Cancel any existing debounce timer and restart.
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null;
          triggerSyncPending();
        }, DEBOUNCE_DELAY_MS);
      },
      {
        // Custom equality: two sets are equal when they have the same IDs.
        equalityFn: (a, b) => a.size === b.size && [...a].every((id) => b.has(id)),
      },
    );

    // On mount: if there are already pending tasks, schedule an initial sync.
    const initial = getPendingListIds(useTaskStore.getState().tasks);
    if (initial.size > 0) {
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        triggerSyncPending();
      }, DEBOUNCE_DELAY_MS);
    }

    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
