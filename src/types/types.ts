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
  sourceEventUid: string | null;
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

export interface CalDavAccount {
  id: string;
  displayName: string;
  serverUrl: string;
  username: string;
  password: string;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewCalDavAccount = Omit<CalDavAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>;

export interface CalDavCalendarMap {
  listId: string;
  accountId: string;
  calendarHref: string;
  syncToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredCalendar {
  href: string;
  displayName: string | null;
  color: string | null;
  supportsSync: boolean;
}

export interface SyncResult {
  accountId: string;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}

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

export interface GitHubAccount {
  id: string;
  displayName: string;
  /** Personal Access Token (stored plaintext for MVP; encrypt before shipping) */
  token: string;
  /** GitHub search query used when fetching issues. Defaults to "assignee:@me is:open". */
  query: string;
  /** When true, sync only pulls issues in — no push or delete back to GitHub. */
  readOnly: boolean;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewGitHubAccount = Omit<GitHubAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>;

export interface GitHubRepoMap {
  /** listId is the PK — one list maps to one repo */
  listId: string;
  accountId: string;
  /** Full repository name, e.g. "owner/repo" */
  repoFullName: string;
  createdAt: string;
  updatedAt: string;
}
