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
  remoteId: string | null        // CalDAV UID or GitHub issue number (was caldavUid)
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
  remoteUrl: string | null       // formerly caldavUrl
  createdAt: string
  updatedAt: string
}

// Unified provider account (replaces CalDavAccount + GitHubAccount)
interface ProviderAccount {
  id: string
  providerType: string           // 'caldav' | 'github'
  displayName: string
  credentials: Record<string, unknown>  // CalDAV: {server_url, username, password}; GitHub: {token}
  lastSyncedAt: string | null
  syncEnabled: boolean
  createdAt: string
  updatedAt: string
}

type NewProviderAccount = Omit<ProviderAccount, 'id' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>

// Unified provider map (replaces CalDavCalendarMap + GitHubRepoMap)
interface ProviderMap {
  id: string                     // own PK (not listId)
  accountId: string
  listId: string | null          // null for events_only maps
  sourceId: string               // calendarHref (CalDAV) or repoFullName (GitHub)
  sourceName: string | null      // display name from discovery
  settings: Record<string, unknown>  // CalDAV: {events_only, sync_token}; GitHub: {query, read_only}
  createdAt: string
  updatedAt: string
}

interface CalendarEvent {
  uid: string; calendarHref: string; summary: string
  description: string | null; dtstart: string | null
  dtend: string | null; location: string | null; color: string | null
}
```

### Derived Types

`NewTask`, `NewTaskList`, `NewProviderAccount` are `Omit<...>` variants stripping auto-generated fields.

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

10 migrations total (v1-v10). Key tables:

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
remote_id        TEXT                       -- CalDAV UID or GitHub issue number (was caldav_uid)
sync_status      TEXT DEFAULT 'pending'
source_event_uid TEXT                       -- links task to originating calendar event
```

Indexes: `idx_tasks_list_id`, `idx_tasks_parent_id`, `idx_tasks_due_date`, `idx_tasks_completed`, `idx_tasks_remote_id`, `idx_tasks_sync_status`, `idx_tasks_source_event_uid`

### lists

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
color       TEXT
remote_url  TEXT                  -- was caldav_url
created_at  TEXT NOT NULL
updated_at  TEXT NOT NULL
```

### settings

```sql
key   TEXT PRIMARY KEY
value TEXT
```

### provider_accounts (replaces caldav_accounts + github_accounts)

```sql
id              TEXT PRIMARY KEY
provider_type   TEXT NOT NULL     -- 'caldav' | 'github'
display_name    TEXT NOT NULL
credentials     TEXT NOT NULL     -- JSON: {server_url,username,password} or {token}
last_synced_at  TEXT
sync_enabled    INTEGER DEFAULT 1
created_at      TEXT NOT NULL
updated_at      TEXT NOT NULL
```

### provider_maps (replaces caldav_calendar_map + github_repo_map)

```sql
id           TEXT PRIMARY KEY
account_id   TEXT NOT NULL REFERENCES provider_accounts(id) ON DELETE CASCADE
list_id      TEXT                  -- nullable (NULL for events_only)
source_id    TEXT NOT NULL         -- calendarHref or repoFullName
source_name  TEXT
settings     TEXT NOT NULL DEFAULT '{}'  -- JSON: {events_only, sync_token} or {query, read_only}
created_at   TEXT NOT NULL
updated_at   TEXT NOT NULL
```

Index: `idx_provider_maps_account_id`, `idx_provider_maps_list_id`

### schema_migrations

```sql
version    INTEGER PRIMARY KEY
applied_at TEXT NOT NULL
```
