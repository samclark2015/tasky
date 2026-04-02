import { useEffect, useRef } from 'react';
import type { DatabaseAdapter } from '@/db/repository';
import { useTaskStore, useListStore, useSyncStore, useUIStore } from '@/stores';

const DEBOUNCE_DELAY_MS = 30_000; // 30 seconds after a task becomes pending

/**
 * Manages two automatic sync triggers:
 *
 * 1. Periodic sync — fires every `syncIntervalMinutes` minutes (if configured).
 * 2. Debounced sync — fires DEBOUNCE_DELAY_MS after the pending-task count
 *    increases (i.e. after the user creates or edits a task).
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

  // ── Helper: trigger a full sync ──────────────────────────────────────────
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
    function countPending(tasks: Map<string, import('@/types').Task>) {
      let n = 0;
      for (const t of tasks.values()) {
        if (t.syncStatus === 'pending') n++;
      }
      return n;
    }

    const unsub = useTaskStore.subscribe(
      (state) => countPending(state.tasks),
      (count, prevCount) => {
        // Only react when pending count increases (new/edited tasks).
        if (count <= prevCount) return;

        // Cancel any existing debounce timer and restart.
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null;
          triggerSync();
        }, DEBOUNCE_DELAY_MS);
      },
    );

    // On mount: if there are already pending tasks, schedule an initial sync.
    const initialPending = countPending(useTaskStore.getState().tasks);
    if (initialPending > 0) {
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        triggerSync();
      }, DEBOUNCE_DELAY_MS);
    }

    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
