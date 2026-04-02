# Data Model

> Part of the `project-map` skill. See `SKILL.md` for overview and directory tree.

## Core Types (src/types/types.ts)

```typescript
interface Task {
  id: string
  listId: string | null          // null = Inbox
  parentId: string | null        // null = root task, else subtask
  title: string
  description: string
  dueDate: string | null         // ISO datetime or date-only
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  recurrence: RecurrenceRule | null
  completed: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
  timeEstimate: number | null    // minutes
  timeSpent: number
  notes: string
  etag: string | null            // CalDAV ETag or GitHub updated_at
  caldavUid: string | null       // CalDAV UID or GitHub issue number
  syncStatus: 'synced' | 'pending' | 'conflict'
  sourceEventUid: string | null  // links task to originating calendar event
}

interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  until?: string
  count?: number
  byDay?: string[]
  byMonthDay?: number
}

interface TaskList {
  id: string
  name: string
  color: string | null
  caldavUrl: string | null
  createdAt: string
  updatedAt: string
}

interface CalDavAccount {
  id: string; displayName: string; serverUrl: string
  username: string; password: string
  lastSyncedAt: string | null; syncEnabled: boolean
  createdAt: string; updatedAt: string
}

interface CalDavCalendarMap {
  listId: string; accountId: string; calendarHref: string
  eventsOnly: boolean; syncToken: string | null
  createdAt: string; updatedAt: string
}

interface GitHubAccount {
  id: string; displayName: string; token: string
  lastSyncedAt: string | null; syncEnabled: boolean
  createdAt: string; updatedAt: string
}

interface GitHubRepoMap {
  listId: string; accountId: string; repoFullName: string
  query: string | null; readOnly: boolean | null
  createdAt: string; updatedAt: string
}

interface CalendarEvent {
  uid: string; calendarHref: string; summary: string
  description: string | null; dtstart: string | null
  dtend: string | null; location: string | null; color: string | null
}

interface SyncResult {
  accountId: string; created: number; updated: number
  deleted: number; conflicts: number; errors: string[]
}
```

### Derived Types

`NewTask`, `NewTaskList`, `NewCalDavAccount`, `NewGitHubAccount` are `Omit<...>` variants stripping auto-generated fields (`id`, `createdAt`, `updatedAt`, `syncStatus`, etc.).

### AppSettings

```typescript
interface AppSettings {
  theme: string
  sidebarWidth: number
  detailsPanelWidth: number
  defaultListId: string | null
}
```

---

## SQL Schema (src/db/migrations/index.ts)

9 migrations total (v1-v9). Key tables:

### tasks

20 columns. FK to lists (ON DELETE SET NULL), self-referencing parentId (ON DELETE CASCADE).

```sql
id               TEXT PRIMARY KEY
list_id          TEXT REFERENCES lists(id) ON DELETE SET NULL
parent_id        TEXT REFERENCES tasks(id) ON DELETE CASCADE
title            TEXT NOT NULL
description      TEXT DEFAULT ''
due_date         TEXT
priority         TEXT DEFAULT 'medium'
tags             TEXT DEFAULT '[]'          -- JSON array
recurrence       TEXT                       -- JSON RecurrenceRule or NULL
completed        INTEGER DEFAULT 0
completed_at     TEXT
created_at       TEXT NOT NULL
updated_at       TEXT NOT NULL
time_estimate    INTEGER                    -- minutes
time_spent       INTEGER DEFAULT 0          -- minutes
notes            TEXT DEFAULT ''
etag             TEXT                       -- CalDAV ETag
caldav_uid       TEXT                       -- CalDAV UID or GitHub issue number
sync_status      TEXT DEFAULT 'pending'
source_event_uid TEXT                       -- links task to originating calendar event
```

Indexes: `idx_tasks_list_id`, `idx_tasks_parent_id`, `idx_tasks_due_date`, `idx_tasks_completed`, `idx_tasks_caldav_uid`, `idx_tasks_sync_status`, `idx_tasks_source_event_uid`, `idx_tasks_caldav_uid2`

### lists

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
color       TEXT
caldav_url  TEXT
created_at  TEXT NOT NULL
updated_at  TEXT NOT NULL
```

### settings

```sql
key   TEXT PRIMARY KEY
value TEXT
```

### caldav_accounts

```sql
id              TEXT PRIMARY KEY
display_name    TEXT NOT NULL
server_url      TEXT NOT NULL
username        TEXT NOT NULL
password        TEXT NOT NULL
last_synced_at  TEXT
sync_enabled    INTEGER DEFAULT 1
created_at      TEXT NOT NULL
updated_at      TEXT NOT NULL
```

### caldav_calendar_map

```sql
list_id        TEXT PRIMARY KEY          -- no FK constraint (v9)
account_id     TEXT NOT NULL REFERENCES caldav_accounts(id) ON DELETE CASCADE
calendar_href  TEXT NOT NULL
events_only    INTEGER NOT NULL DEFAULT 0
sync_token     TEXT
created_at     TEXT NOT NULL
updated_at     TEXT NOT NULL
```

Index: `idx_caldav_calendar_map_account_id`

### github_accounts

```sql
id              TEXT PRIMARY KEY
display_name    TEXT NOT NULL
token           TEXT NOT NULL
last_synced_at  TEXT
sync_enabled    INTEGER DEFAULT 1
created_at      TEXT NOT NULL
updated_at      TEXT NOT NULL
```

### github_repo_map

```sql
list_id         TEXT PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE
account_id      TEXT NOT NULL REFERENCES github_accounts(id) ON DELETE CASCADE
repo_full_name  TEXT NOT NULL
query           TEXT
read_only       INTEGER
created_at      TEXT NOT NULL
updated_at      TEXT NOT NULL
```

Index: `idx_github_repo_map_account_id`

### schema_migrations

```sql
version    INTEGER PRIMARY KEY
applied_at TEXT NOT NULL
```
