import { useUIStore } from '@/stores';
import { PanelLeftOpen, CalendarDays } from 'lucide-react';

export function CalendarView() {
  const { toggleSidebar, sidebarOpen } = useUIStore();

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-lg font-semibold">Calendar</h1>
      </header>

      <div className="flex-1 flex items-center justify-center text-muted-foreground gap-3">
        <CalendarDays className="h-10 w-10 opacity-30" />
        <p className="text-sm">Calendar view coming in Phase 3</p>
      </div>
    </div>
  );
}
