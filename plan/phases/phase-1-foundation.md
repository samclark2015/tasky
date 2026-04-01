# Phase 1: Foundation

**Duration:** Week 1  
**Goal:** Establish project architecture and basic app shell

## Objectives

1. Set up monorepo structure with pnpm workspaces
2. Configure Tauri 2.x with React + TypeScript
3. Integrate SQLite for local storage
4. Create basic three-panel app shell
5. Set up Zustand stores
6. Install and configure shadcn/ui

## Dependencies

None - this is the first phase.

## Tasks

### 1.1 Monorepo Setup
- [ ] Initialize pnpm workspace
- [ ] Create `apps/desktop` for Tauri app
- [ ] Create `packages/core` for shared logic
- [ ] Create `packages/db` for database layer
- [ ] Configure TypeScript paths and references
- [ ] Set up ESLint and Prettier

### 1.2 Tauri Configuration
- [ ] Initialize Tauri 2.x project in `apps/desktop`
- [ ] Configure app metadata (name, identifier, version)
- [ ] Set up development scripts
- [ ] Configure tauri-plugin-sql for SQLite
- [ ] Test basic Tauri ↔ React communication

### 1.3 React + TypeScript Setup
- [ ] Configure Vite for React
- [ ] Set up TypeScript strict mode
- [ ] Configure path aliases (@/, @core/, @db/)
- [ ] Add React Router for navigation

### 1.4 Database Layer
- [ ] Design initial SQLite schema (tasks, lists, settings)
- [ ] Set up migration system
- [ ] Create database initialization logic
- [ ] Implement basic CRUD helpers in `packages/db`

### 1.5 State Management
- [ ] Set up Zustand store structure
- [ ] Create stores: tasks, lists, ui, sync
- [ ] Implement persistence middleware (sync with SQLite)

### 1.6 UI Foundation
- [ ] Install shadcn/ui and dependencies
- [ ] Configure Tailwind CSS
- [ ] Set up theme (light/dark mode support)
- [ ] Create layout components:
  - [ ] AppShell (three-panel container)
  - [ ] Sidebar (collapsible)
  - [ ] MainPanel
  - [ ] DetailsPanel (collapsible)
- [ ] Implement basic navigation between views

## Deliverables

By the end of Phase 1:
- ✅ Running Tauri app with React frontend
- ✅ SQLite database initialized on app start
- ✅ Three-panel layout visible and responsive
- ✅ Sidebar with navigation items (Today, Inbox, Calendar, Planner)
- ✅ Theme switching (light/dark)
- ✅ All packages building successfully

## Technical Notes

### SQLite Schema (Initial)

```sql
CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  caldav_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  list_id TEXT REFERENCES lists(id),
  parent_id TEXT REFERENCES tasks(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TEXT,
  priority TEXT DEFAULT 'medium',
  tags TEXT DEFAULT '[]',  -- JSON array
  recurrence TEXT,         -- JSON RRULE
  completed INTEGER DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  time_estimate INTEGER,
  time_spent INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  etag TEXT,
  caldav_uid TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Zustand Store Structure

```typescript
// stores/tasks.ts
interface TaskStore {
  tasks: Map<string, Task>;
  loading: boolean;
  // Actions
  loadTasks: () => Promise<void>;
  createTask: (task: NewTask) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

// stores/ui.ts
interface UIStore {
  sidebarOpen: boolean;
  detailsPanelOpen: boolean;
  selectedTaskId: string | null;
  currentView: 'today' | 'inbox' | 'calendar' | 'planner' | 'list';
  currentListId: string | null;
  // Actions
  toggleSidebar: () => void;
  toggleDetailsPanel: () => void;
  selectTask: (id: string | null) => void;
  navigateTo: (view: string, listId?: string) => void;
}
```
