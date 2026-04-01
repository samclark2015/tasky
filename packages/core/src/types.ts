export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  until?: string;
  count?: number;
  byDay?: string[];
  byMonthDay?: number[];
}

export interface Task {
  id: string;
  listId: string | null;
  parentId: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  recurrence: RecurrenceRule | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  timeEstimate: number | null;
  timeSpent: number;
  notes: string;
  etag: string | null;
  caldavUid: string | null;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>;

export interface TaskList {
  id: string;
  name: string;
  color: string | null;
  caldavUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewTaskList = Omit<TaskList, 'id' | 'createdAt' | 'updatedAt'>;

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  sidebarWidth: number;
  detailsPanelWidth: number;
  defaultListId: string | null;
}
