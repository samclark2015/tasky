import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { Sidebar } from './sidebar';
import { DetailsPanel } from './details-panel';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarOpen, detailsPanelOpen } = useUIStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          'flex-shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-200 flex flex-col',
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
        )}
      >
        <Sidebar />
      </aside>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* drag region when sidebar is hidden — covers the traffic light area */}
        {!sidebarOpen && (
          <div
            data-tauri-drag-region
            className="drag-region h-8 flex-shrink-0 select-none"
          />
        )}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      </main>

      {detailsPanelOpen && (
        <aside className="flex-shrink-0 w-80 border-l border-border bg-background overflow-y-auto">
          <DetailsPanel />
        </aside>
      )}
    </div>
  );
}
