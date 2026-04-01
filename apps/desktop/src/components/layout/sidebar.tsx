import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore, useListStore, type ViewType } from '@/stores';
import {
  CalendarDays,
  CheckSquare,
  Inbox,
  LayoutList,
  Moon,
  Sun,
  Monitor,
  PanelLeftClose,
  Plus,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { ListModal } from '@/components/modals/list-modal';
import type { TaskList } from '@core/types';

interface NavItem {
  view: ViewType;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'today', label: 'Today', icon: <CheckSquare className="h-4 w-4" /> },
  { view: 'inbox', label: 'Inbox', icon: <Inbox className="h-4 w-4" /> },
  { view: 'search', label: 'Search', icon: <Search className="h-4 w-4" /> },
  { view: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-4 w-4" /> },
  { view: 'planner', label: 'Planner', icon: <LayoutList className="h-4 w-4" /> },
];

export function Sidebar() {
  const { currentView, currentListId, navigateTo, toggleSidebar } = useUIStore();
  const { lists } = useListStore();
  const { theme, setTheme } = useTheme();
  const [showNewList, setShowNewList] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);

  const nextTheme = () => {
    const cycle: Record<string, 'light' | 'dark' | 'system'> = {
      light: 'dark', dark: 'system', system: 'light',
    };
    setTheme(cycle[theme] ?? 'system');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <>
      <div className="flex flex-col h-full no-select">
        <div
          data-tauri-drag-region
          className="drag-region flex items-center justify-between px-3 pb-2 pt-8 border-b border-sidebar-border flex-shrink-0 select-none"
        >
          <span className="font-semibold text-sm text-sidebar-foreground pointer-events-none">Tasky</span>
          <button
            onClick={toggleSidebar}
            aria-label="Close sidebar"
            className="no-drag p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              onClick={() => navigateTo(item.view)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                currentView === item.view && currentListId === null
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {lists.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lists
                </span>
              </div>
              {lists.map((list) => (
                <div key={list.id} className="group relative flex items-center">
                  <button
                    onClick={() => navigateTo('list', list.id)}
                    className={cn(
                      'flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                      currentView === 'list' && currentListId === list.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: list.color ?? '#6366f1' }}
                    />
                    <span className="truncate flex-1 text-left">{list.name}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingList(list); }}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sidebar-accent text-muted-foreground transition-all"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </nav>

        <div className="px-2 py-2 border-t border-sidebar-border flex items-center justify-between">
          <button
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            onClick={() => setShowNewList(true)}
          >
            <Plus className="h-4 w-4" />
            New List
          </button>
          <button
            onClick={nextTheme}
            className="p-1.5 rounded-md hover:bg-sidebar-accent/60 text-muted-foreground hover:text-sidebar-foreground transition-colors"
            aria-label="Toggle theme"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showNewList && <ListModal onClose={() => setShowNewList(false)} />}
      {editingList && <ListModal list={editingList} onClose={() => setEditingList(null)} />}
    </>
  );
}
