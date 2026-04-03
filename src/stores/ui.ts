import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewType = 'today' | 'inbox' | 'calendar' | 'planner' | 'list' | 'search' | 'settings';
export type Theme = 'light' | 'dark' | 'system';
export type SyncInterval = 5 | 15 | 30 | 60 | null;

interface UIStore {
  sidebarOpen: boolean;
  detailsPanelOpen: boolean;
  selectedTaskId: string | null;
  currentView: ViewType;
  currentListId: string | null;
  theme: Theme;
  searchQuery: string;
  searchOpen: boolean;
  syncIntervalMinutes: SyncInterval;
  moreSheetOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDetailsPanel: () => void;
  setDetailsPanelOpen: (open: boolean) => void;
  selectTask: (id: string | null) => void;
  navigateTo: (view: ViewType, listId?: string) => void;
  setTheme: (theme: Theme) => void;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setSyncInterval: (interval: SyncInterval) => void;
  setMoreSheetOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      detailsPanelOpen: false,
      selectedTaskId: null,
      currentView: 'today',
      currentListId: null,
      theme: 'system',
      searchQuery: '',
      searchOpen: false,
      syncIntervalMinutes: null,
      moreSheetOpen: false,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleDetailsPanel: () => set((state) => ({ detailsPanelOpen: !state.detailsPanelOpen })),
      setDetailsPanelOpen: (open) => set({ detailsPanelOpen: open }),

      selectTask: (id) =>
        set({ selectedTaskId: id, detailsPanelOpen: id !== null }),

      navigateTo: (view, listId) =>
        set({ currentView: view, currentListId: listId ?? null, selectedTaskId: null, detailsPanelOpen: false }),

      setTheme: (theme) => set({ theme }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSearchOpen: (open) => set({ searchOpen: open }),
      setSyncInterval: (interval) => set({ syncIntervalMinutes: interval }),
      setMoreSheetOpen: (open) => set({ moreSheetOpen: open }),
    }),
    {
      name: 'tasky-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        syncIntervalMinutes: state.syncIntervalMinutes,
      }),
    }
  )
);
