import { motion } from 'framer-motion';
import { CheckSquare, Inbox, CalendarDays, LayoutList, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, type ViewType } from '@/stores';

interface TabItem {
  id: ViewType | 'more';
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  { id: 'today',    label: 'Today',    icon: <CheckSquare className="h-5 w-5" /> },
  { id: 'inbox',    label: 'Inbox',    icon: <Inbox className="h-5 w-5" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-5 w-5" /> },
  { id: 'planner',  label: 'Planner',  icon: <LayoutList className="h-5 w-5" /> },
  { id: 'more',     label: 'More',     icon: <MoreHorizontal className="h-5 w-5" /> },
];

export function BottomNav() {
  const { currentView, navigateTo, setMoreSheetOpen, selectTask } = useUIStore();

  function handleTab(id: ViewType | 'more') {
    if (id === 'more') {
      setMoreSheetOpen(true);
      return;
    }
    navigateTo(id);
    selectTask(null);
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border min-h-[56px] flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id !== 'more' && currentView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTab(tab.id)}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isActive && (
              <motion.span
                layoutId="nav-indicator"
                className="absolute top-0 inset-x-2 h-0.5 rounded-full bg-primary"
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              />
            )}
            {tab.icon}
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
