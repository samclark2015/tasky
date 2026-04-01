import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DatabaseAdapter } from '@db/repository';
import { runMigrations } from '@db/migrate';
import { getDatabase, createAdapter } from '@/lib/database';
import { useTaskStore, useListStore } from '@/stores';

interface AppContextValue {
  adapter: DatabaseAdapter | null;
  ready: boolean;
  error: string | null;
}

const AppContext = createContext<AppContextValue>({ adapter: null, ready: false, error: null });

export function AppProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const db = await getDatabase();
        const adp = createAdapter(db);
        await runMigrations(adp);
        setAdapter(adp);

        await Promise.all([
          useTaskStore.getState().loadTasks(adp),
          useListStore.getState().loadLists(adp),
        ]);

        setReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    }
    init();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
        <p className="text-destructive font-semibold text-sm">Database failed to initialize</p>
        <p className="text-muted-foreground text-xs max-w-sm font-mono bg-muted px-3 py-2 rounded break-all">
          {error}
        </p>
        <p className="text-muted-foreground text-xs">
          Make sure you're running <code className="bg-muted px-1 rounded">tauri dev</code> and not plain <code className="bg-muted px-1 rounded">vite dev</code>.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ adapter, ready, error }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
