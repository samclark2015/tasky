import { useEffect, useState } from 'react';
import { useUIStore, type ViewType } from '@/stores';
import { useTheme } from '@/components/theme-provider';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { AppShell } from '@/components/layout';
import { TodayView } from '@/views/today';
import { InboxView } from '@/views/inbox';
import { CalendarView } from '@/views/calendar';
import { PlannerView } from '@/views/planner';
import { ListView } from '@/views/list';
import { SearchView } from '@/views/search';
import { SettingsView } from '@/views/settings';
import { TaskModal } from '@/components/modals/task-modal';
import { UpdateModal } from '@/components/modals/update-modal';

function ViewRouter({ view }: { view: ViewType }) {
  switch (view) {
    case 'today':    return <TodayView />;
    case 'inbox':    return <InboxView />;
    case 'calendar': return <CalendarView />;
    case 'planner':  return <PlannerView />;
    case 'list':     return <ListView />;
    case 'search':   return <SearchView />;
    case 'settings': return <SettingsView />;
    default:         return <TodayView />;
  }
}

export function App() {
  const { currentView, navigateTo, selectTask, setSearchQuery } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [showNewTask, setShowNewTask] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  // Check for updates on startup
  useEffect(() => {
    check()
      .then((update) => {
        if (update) setPendingUpdate(update);
      })
      .catch((err) => {
        console.error('Update check failed:', err);
      });
  }, []);

  useEffect(() => {
    invoke('sync_theme', { theme });
  }, [theme]);

  useEffect(() => {
    const unlisten = listen<string>('set-theme', (e) => {
      if (e.payload === 'light' || e.payload === 'dark' || e.payload === 'system') {
        setTheme(e.payload);
      }
    });
    return () => { unlisten.then(f => f()); };
  }, [setTheme]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Cmd/Ctrl+F — search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        navigateTo('search');
        return;
      }

      if (isInput) return;

      // n — new task
      if (e.key === 'n') { e.preventDefault(); setShowNewTask(true); }
      // Escape — deselect
      if (e.key === 'Escape') { selectTask(null); }
      // 1-4 — nav shortcuts
      if (e.key === '1') navigateTo('today');
      if (e.key === '2') navigateTo('inbox');
      if (e.key === '3') navigateTo('calendar');
      if (e.key === '4') navigateTo('planner');
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateTo, selectTask, setSearchQuery]);

  return (
    <>
      <AppShell>
        <ViewRouter view={currentView} />
      </AppShell>

      {showNewTask && (
        <TaskModal onClose={() => setShowNewTask(false)} />
      )}

      {pendingUpdate && (
        <UpdateModal update={pendingUpdate} onClose={() => setPendingUpdate(null)} />
      )}
    </>
  );
}
