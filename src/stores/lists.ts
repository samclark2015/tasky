import { create } from 'zustand';
import type { TaskList } from '@/types/types';
import type { DatabaseAdapter } from '@/db/repository';
import { createListRepository } from '@/db/repository';
import { generateId } from '@/lib/utils';

interface ListStore {
  lists: TaskList[];
  loading: boolean;
  error: string | null;
  loadLists: (adapter: DatabaseAdapter) => Promise<void>;
  createList: (adapter: DatabaseAdapter, name: string, color?: string) => Promise<TaskList>;
  updateList: (adapter: DatabaseAdapter, id: string, updates: Partial<TaskList>) => Promise<void>;
  deleteList: (adapter: DatabaseAdapter, id: string) => Promise<void>;
}

export const useListStore = create<ListStore>()((set) => ({
  lists: [],
  loading: false,
  error: null,

  async loadLists(adapter) {
    set({ loading: true, error: null });
    try {
      const repo = createListRepository(adapter);
      const lists = await repo.getAll();
      set({ lists, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createList(adapter, name, color) {
    const repo = createListRepository(adapter);
    const id = generateId();
    const now = new Date().toISOString();
    const list: TaskList = {
      id,
      name,
      color: color ?? null,
      remoteUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    await repo.create(list);
    set((state) => ({ lists: [...state.lists, list] }));
    return list;
  },

  async updateList(adapter, id, updates) {
    const repo = createListRepository(adapter);
    await repo.update(id, updates);
    set((state) => ({
      lists: state.lists.map((l) =>
        l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
      ),
    }));
  },

  async deleteList(adapter, id) {
    const repo = createListRepository(adapter);
    await repo.delete(id);
    set((state) => ({ lists: state.lists.filter((l) => l.id !== id) }));
  },
}));
