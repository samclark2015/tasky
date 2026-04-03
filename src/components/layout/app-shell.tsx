import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Sidebar } from './sidebar';
import { DetailsPanel } from './details-panel';
import { BottomSheet } from './bottom-sheet';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarOpen, detailsPanelOpen, selectTask } = useUIStore();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar — hidden on mobile (bottom nav replaces it) */}
      <aside
        className={cn(
          'flex-shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-200 flex flex-col',
          'hidden md:flex',
          sidebarOpen ? 'md:w-60' : 'md:w-14'
        )}
      >
        <Sidebar />
      </aside>

      <main
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
        style={isMobile ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        {/* Tauri drag region — only on desktop (non-functional on Android) */}
        {!isMobile && (
          <div
            data-tauri-drag-region
            className="drag-region h-8 flex-shrink-0 select-none"
          />
        )}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      </main>

      {/* Details panel — right column on desktop, bottom sheet on mobile */}
      {!isMobile && detailsPanelOpen && (
        <aside className="flex-shrink-0 w-80 border-l border-border bg-background overflow-y-auto">
          <DetailsPanel />
        </aside>
      )}

      {isMobile && (
        <BottomSheet open={detailsPanelOpen} onClose={() => selectTask(null)}>
          <DetailsPanel />
        </BottomSheet>
      )}
    </div>
  );
}
