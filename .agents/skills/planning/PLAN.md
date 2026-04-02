# Tasky - Master Development Plan

A cross-platform task management app for todos, tasks, and routines with CalDAV sync.

## Overview

**Target:** MVP in ~6 weeks  
**Primary Platform:** Desktop (macOS, Windows, Linux)  
**Future Platforms:** iOS, Android, Web

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.x |
| Frontend | React 18 + TypeScript |
| Styling | shadcn/ui + Radix UI + Tailwind CSS |
| State Management | Zustand |
| Local Database | SQLite (via tauri-plugin-sql) |
| Calendar UI | FullCalendar |
| Package Manager | pnpm (workspaces) |
| Testing | Vitest |

## Architecture Decisions

### Offline-First
- All data stored locally in SQLite
- App fully functional without internet
- Sync happens opportunistically when connected

### CalDAV Integration
- Lists map to CalDAV calendars
- Tasks sync as VTODO components
- Last-write-wins conflict resolution
- Basic auth credentials stored securely via Tauri

### Data Model
- Tasks support unlimited subtask nesting
- Recurrence follows iCalendar RRULE spec
- All timestamps in UTC, displayed in local timezone

### UI/UX
- Three-panel layout (sidebar, main, details)
- Unified design for MVP (platform-adaptive post-MVP)
- System notifications only (no in-app notification center)

## Phase Overview

| Phase | Name | Duration | Focus |
|-------|------|----------|-------|
| 1 | Foundation | Week 1 | Project setup, architecture, app shell |
| 2 | Core Tasks | Week 2-3 | Task CRUD, lists, Today/Inbox views |
| 3 | Views | Week 3-4 | Calendar, Planner, recurrence |
| 4 | CalDAV Sync | Week 4-5 | Two-way sync with CalDAV servers |
| 5 | Polish | Week 5-6 | Notifications, testing, builds |
| 6 | Provider Abstraction | Week 7-8 | Make TS layer fully provider-agnostic |

## Project Structure

```
tasky/
├── src/              # React frontend
│   ├── types/        # Shared domain types (inlined from @tasky/core)
│   ├── db/           # Database layer (inlined from @tasky/db)
│   ├── stores/       # Zustand state stores
│   ├── components/   # React components
│   ├── views/        # Route-level views
│   ├── providers/    # IPC bridge to Rust
│   └── lib/          # Utilities
├── src-tauri/        # Rust/Tauri backend
├── providers/        # Rust sync providers crate (CalDAV, GitHub)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json      # Single root package (no workspaces)
└── Cargo.toml        # Cargo workspace: [src-tauri, providers]
```

## Task Data Model

```typescript
interface Task {
  id: string;
  listId: string;
  parentId: string | null;      // For subtasks
  title: string;
  description: string;
  dueDate: Date | null;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  recurrence: RecurrenceRule | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  timeEstimate: number | null;  // Minutes
  timeSpent: number;            // Minutes
  notes: string;
  // CalDAV sync fields
  etag: string | null;
  caldavUid: string | null;
  syncStatus: 'synced' | 'pending' | 'conflict';
  sourceEventUid: string | null; // UID of originating VEVENT if promoted from calendar event
}

interface CalendarEvent {
  uid: string;
  calendarHref: string;    // CalDAV calendar this event belongs to
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  description: string;
  location: string | null;
  color: string | null;
}
```

## Success Criteria for MVP

- [ ] Create, edit, delete tasks with all fields
- [ ] Unlimited subtask nesting
- [ ] Multiple lists
- [ ] Today view showing tasks due today
- [ ] Inbox view for unassigned tasks
- [ ] Calendar view (day/week/month)
- [ ] Calendar view shows CalDAV calendar events (VEVENTs) read-only alongside tasks
- [ ] Per-calendar visibility toggles on calendar view
- [ ] Click calendar event → event detail popover with "Add to Tasks" action
- [ ] "Add to Tasks" promotes event to task (pre-filled, syncs back as VTODO)
- [ ] Planner view with drag-to-schedule
- [ ] Recurring tasks
- [ ] CalDAV sync with Fastmail/iCloud/standard servers
- [ ] System notifications for due tasks
- [ ] Desktop builds for Mac/Windows/Linux
