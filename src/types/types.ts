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
  remoteId: string | null;
  syncStatus: 'synced' | 'pending' | 'conflict';
  sourceEventUid: string | null;
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>;

export interface TaskList {
  id: string;
  name: string;
  color: string | null;
  remoteUrl: string | null;
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

// ── Generic provider types ───────────────────────────────────────────────────

export interface ProviderAccount {
  id: string;
  providerType: string;
  displayName: string;
  credentials: Record<string, unknown>;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewProviderAccount = Omit<ProviderAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>;

export interface ProviderMap {
  id: string;
  accountId: string;
  listId: string | null;
  sourceId: string;
  sourceName: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── CalendarEvent (kept for calendar view) ───────────────────────────────────

export interface CalendarEvent {
  uid: string;
  calendarHref: string;
  summary: string;
  description: string | null;
  dtstart: string | null;
  dtend: string | null;
  location: string | null;
  color: string | null;
}
