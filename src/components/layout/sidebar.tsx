import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore, useListStore, useSyncStore, type ViewType } from '@/stores';
import {
  CalendarDays,
  CheckSquare,
  Inbox,
  LayoutList,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MoreHorizontal,
  Search,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ListModal } from '@/components/modals/list-modal';
import { useApp } from '@/components/app-provider';
import { useTaskStore } from '@/stores/tasks';
import type { TaskList } from '@/types/types';

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

interface TooltipState {
  label: string;
  y: number;
  x: number;
}

function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const show = useCallback((e: React.MouseEvent<HTMLElement>, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, x: rect.right + 8, y: rect.top + rect.height / 2 });
  }, []);

  const hide = useCallback(() => setTooltip(null), []);

  return { tooltip, show, hide };
}

export function Sidebar() {
  const { currentView, currentListId, navigateTo, toggleSidebar, sidebarOpen } = useUIStore();
  const { lists } = useListStore();
  const { syncStatus, isSyncing, syncAll } = useSyncStore();
  const { tasks } = useTaskStore();
  const { adapter } = useApp();
  const [showNewList, setShowNewList] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const { tooltip, show, hide } = useTooltip();

  function handleSync() {
    if (!adapter) return;
    syncAll(
      adapter,
      Array.from(tasks.values()),
      lists,
      () => useTaskStore.getState().loadTasks(adapter),
      () => useListStore.getState().loadLists(adapter),
    );
  }

  return (
    <>
      {/* Fixed tooltip rendered outside sidebar so it's never clipped */}
      {!sidebarOpen && tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          <div className="bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-md whitespace-nowrap border border-border">
            {tooltip.label}
          </div>
        </div>
      )}

      <div className="flex flex-col h-full no-select overflow-hidden">
        {/* Header */}
        <div
          data-tauri-drag-region
          className={cn(
            'drag-region flex items-center border-b border-sidebar-border flex-shrink-0 select-none',
            sidebarOpen ? 'justify-between px-3 pb-2 pt-8' : 'justify-center px-0 pb-2 pt-8'
          )}
        >
          {sidebarOpen && (
            <span className="font-semibold text-sm text-sidebar-foreground pointer-events-none">Tasky</span>
          )}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="no-drag p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            {sidebarOpen
              ? <PanelLeftClose className="h-4 w-4" />
              : <PanelLeftOpen className="h-4 w-4" />
            }
          </button>
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 overflow-y-auto py-2 space-y-0.5', sidebarOpen ? 'px-2' : 'px-1.5')}>
          {NAV_ITEMS.map((item) => {
            const active = currentView === item.view && currentListId === null;
            return (
              <button
                key={item.view}
                onClick={() => navigateTo(item.view)}
                onMouseEnter={!sidebarOpen ? (e) => show(e, item.label) : undefined}
                onMouseLeave={!sidebarOpen ? hide : undefined}
                className={cn(
                  'w-full flex items-center rounded-md text-sm transition-colors',
                  sidebarOpen ? 'gap-2.5 px-2.5 py-1.5' : 'justify-center px-0 py-2',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                )}
              >
                {item.icon}
                {sidebarOpen && item.label}
              </button>
            );
          })}

          {sidebarOpen && lists.length > 0 && (
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

          {!sidebarOpen && lists.map((list) => (
            <button
              key={list.id}
              onClick={() => navigateTo('list', list.id)}
              onMouseEnter={(e) => show(e, list.name)}
              onMouseLeave={hide}
              className={cn(
                'w-full flex justify-center py-2 rounded-md transition-colors',
                currentView === 'list' && currentListId === list.id
                  ? 'bg-sidebar-accent'
                  : 'hover:bg-sidebar-accent/60'
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: list.color ?? '#6366f1' }}
              />
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn(
          'py-2 border-t border-sidebar-border flex flex-col gap-0.5',
          sidebarOpen ? 'px-2' : 'px-1.5 items-center'
        )}>
          {/* Sync status button */}
          {sidebarOpen ? (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors w-full',
                syncStatus === 'error'
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )}
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : syncStatus === 'error' ? (
                <WifiOff className="h-4 w-4" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              {isSyncing ? 'Syncing…' : syncStatus === 'error' ? 'Sync error' : 'Sync'}
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              onMouseEnter={(e) => show(e, 'Sync')}
              onMouseLeave={hide}
              className={cn(
                'w-full flex justify-center p-2 rounded-md transition-colors',
                syncStatus === 'error'
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
              )}
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : syncStatus === 'error' ? (
                <WifiOff className="h-4 w-4" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Settings */}
          {sidebarOpen ? (
            <button
              onClick={() => navigateTo('settings')}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors w-full',
                currentView === 'settings'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          ) : (
            <button
              onClick={() => navigateTo('settings')}
              onMouseEnter={(e) => show(e, 'Settings')}
              onMouseLeave={hide}
              className={cn(
                'w-full flex justify-center p-2 rounded-md transition-colors',
                currentView === 'settings'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          {/* New List */}
          {sidebarOpen ? (
            <button
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
              onClick={() => setShowNewList(true)}
            >
              <Plus className="h-4 w-4" />
              New List
            </button>
          ) : (
            <button
              onClick={() => setShowNewList(true)}
              onMouseEnter={(e) => show(e, 'New List')}
              onMouseLeave={hide}
              className="w-full flex justify-center p-2 rounded-md hover:bg-sidebar-accent/60 text-muted-foreground hover:text-sidebar-foreground transition-colors"
              aria-label="New List"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showNewList && <ListModal onClose={() => setShowNewList(false)} />}
      {editingList && <ListModal list={editingList} onClose={() => setEditingList(null)} />}
    </>
  );
}
