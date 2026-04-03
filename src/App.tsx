import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore, type ViewType } from '@/stores';
import { useTheme } from '@/components/theme-provider';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { AppShell } from '@/components/layout';
import { BottomNav } from '@/components/layout/bottom-nav';
import { MoreSheet } from '@/components/layout/more-sheet';
import { FAB } from '@/components/ui/fab';
import { TodayView } from '@/views/today';
import { InboxView } from '@/views/inbox';
import { CalendarView } from '@/views/calendar';
import { PlannerView } from '@/views/planner';
import { ListView } from '@/views/list';
import { SearchView } from '@/views/search';
import { SettingsView } from '@/views/settings';
import { TaskModal } from '@/components/modals/task-modal';
import { SearchModal } from '@/components/modals/search-modal';
import { UpdateModal } from '@/components/modals/update-modal';

const VIEW_ORDER: Record<ViewType, number> = {
  today: 0,
  inbox: 1,
  calendar: 2,
  planner: 3,
  list: 3,
  search: 4,
  settings: 5,
};

function ViewContent({ view }: { view: ViewType }) {
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

function ViewRouter({ view }: { view: ViewType }) {
  const isMobile = useIsMobile();
  const previousViewRef = useRef<ViewType>(view);
  const directionRef = useRef<number>(1);

  // Compute slide direction before updating previousView
  if (previousViewRef.current !== view) {
    directionRef.current =
      VIEW_ORDER[view] >= VIEW_ORDER[previousViewRef.current] ? 1 : -1;
    previousViewRef.current = view;
  }

  const direction = directionRef.current;

  if (!isMobile) {
    return <ViewContent view={view} />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        initial={{ x: direction * 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: direction * -40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        <ViewContent view={view} />
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  const { currentView, navigateTo, selectTask, setSearchOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
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
      // Disable all keyboard shortcuts on mobile
      if (isMobile) return;

      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Cmd/Ctrl+F — search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
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
  }, [isMobile, navigateTo, selectTask, setSearchOpen]);

  return (
    <>
      <AppShell>
        <ViewRouter view={currentView} />
      </AppShell>

      {/* Mobile-only chrome */}
      {isMobile && <BottomNav />}
      {isMobile && <MoreSheet />}
      {isMobile && <FAB onClick={() => setShowNewTask(true)} />}

      {showNewTask && (
        <TaskModal onClose={() => setShowNewTask(false)} />
      )}

      {pendingUpdate && (
        <UpdateModal update={pendingUpdate} onClose={() => setPendingUpdate(null)} />
      )}

      <SearchModal />
    </>
  );
}
