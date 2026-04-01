import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Task } from '@core/types';
import type { DatabaseAdapter } from '@db/repository';
import { createTaskRepository } from '@db/repository';
import { generateId } from '@/lib/utils';

interface TaskStore {
  tasks: Map<string, Task>;
  loading: boolean;
  error: string | null;
  loadTasks: (adapter: DatabaseAdapter) => Promise<void>;
  createTask: (adapter: DatabaseAdapter, task: Partial<Task> & { title: string }) => Promise<Task>;
  updateTask: (adapter: DatabaseAdapter, id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (adapter: DatabaseAdapter, id: string) => Promise<void>;
  toggleComplete: (adapter: DatabaseAdapter, id: string) => Promise<void>;
  getTasksByList: (listId: string) => Task[];
  getTodayTasks: () => Task[];
  getInboxTasks: () => Task[];
  getSubtasks: (parentId: string) => Task[];
}

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    tasks: new Map(),
    loading: false,
    error: null,

    async loadTasks(adapter) {
      set({ loading: true, error: null });
      try {
        const repo = createTaskRepository(adapter);
        const tasks = await repo.getAll();
        const map = new Map(tasks.map((t) => [t.id, t]));
        set({ tasks: map, loading: false });
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    async createTask(adapter, partial) {
      const repo = createTaskRepository(adapter);
      const id = generateId();
      const now = new Date().toISOString();
      const task: Task = {
        id,
        listId: partial.listId || null,
        parentId: partial.parentId ?? null,
        title: partial.title,
        description: partial.description ?? '',
        dueDate: partial.dueDate ?? null,
        priority: partial.priority ?? 'medium',
        tags: partial.tags ?? [],
        recurrence: partial.recurrence ?? null,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        timeEstimate: partial.timeEstimate ?? null,
        timeSpent: 0,
        notes: partial.notes ?? '',
        etag: null,
        caldavUid: null,
        syncStatus: 'pending',
      };
      await repo.create(task);
      set((state) => {
        const tasks = new Map(state.tasks);
        tasks.set(id, task);
        return { tasks };
      });
      return task;
    },

    async updateTask(adapter, id, updates) {
      const repo = createTaskRepository(adapter);
      // If the caller didn't explicitly set syncStatus and the task is linked to
      // CalDAV, mark it pending so the next sync pushes the change.
      const existing = get().tasks.get(id);
      const effectiveUpdates =
        updates.syncStatus === undefined && existing?.caldavUid
          ? { ...updates, syncStatus: 'pending' as const }
          : updates;
      await repo.update(id, effectiveUpdates);
      set((state) => {
        const tasks = new Map(state.tasks);
        const cur = tasks.get(id);
        if (cur) {
          tasks.set(id, { ...cur, ...effectiveUpdates, updatedAt: new Date().toISOString() });
        }
        return { tasks };
      });
    },

    async deleteTask(adapter, id) {
      const repo = createTaskRepository(adapter);
      // collect all descendant ids to remove from memory
      const allTasks = Array.from(get().tasks.values());
      function collectDescendants(parentId: string): string[] {
        const children = allTasks.filter((t) => t.parentId === parentId);
        return [parentId, ...children.flatMap((c) => collectDescendants(c.id))];
      }
      const toDelete = collectDescendants(id);
      await repo.delete(id); // SQLite ON DELETE CASCADE handles children
      set((state) => {
        const tasks = new Map(state.tasks);
        for (const did of toDelete) tasks.delete(did);
        return { tasks };
      });
    },

    async toggleComplete(adapter, id) {
      const task = get().tasks.get(id);
      if (!task) return;
      const completed = !task.completed;
      const completedAt = completed ? new Date().toISOString() : null;
      await get().updateTask(adapter, id, { completed, completedAt });
    },

    getTasksByList(listId) {
      return Array.from(get().tasks.values()).filter(
        (t) => t.listId === listId && t.parentId === null
      );
    },

    getTodayTasks() {
      const today = new Date().toISOString().split('T')[0];
      return Array.from(get().tasks.values()).filter(
        (t) => !t.completed && t.dueDate?.startsWith(today)
      );
    },

    getInboxTasks() {
      return Array.from(get().tasks.values()).filter(
        (t) => !t.listId && !t.completed && t.parentId === null
      );
    },

    getSubtasks(parentId) {
      return Array.from(get().tasks.values()).filter((t) => t.parentId === parentId);
    },
  }))
);
