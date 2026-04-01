import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewType = 'today' | 'inbox' | 'calendar' | 'planner' | 'list' | 'search';
export type Theme = 'light' | 'dark' | 'system';

interface UIStore {
  sidebarOpen: boolean;
  detailsPanelOpen: boolean;
  selectedTaskId: string | null;
  currentView: ViewType;
  currentListId: string | null;
  theme: Theme;
  searchQuery: string;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDetailsPanel: () => void;
  setDetailsPanelOpen: (open: boolean) => void;
  selectTask: (id: string | null) => void;
  navigateTo: (view: ViewType, listId?: string) => void;
  setTheme: (theme: Theme) => void;
  setSearchQuery: (q: string) => void;
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
    }),
    {
      name: 'tasky-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
      }),
    }
  )
);
