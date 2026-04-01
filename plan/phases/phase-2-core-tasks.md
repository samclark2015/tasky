# Phase 2: Core Task Management

**Duration:** Week 2-3  
**Goal:** Implement full task CRUD with lists and basic views

## Objectives

1. Complete task data model with all fields
2. Implement task creation, editing, and deletion
3. Support unlimited subtask nesting
4. Implement list management
5. Build Today and Inbox views

## Dependencies

- Phase 1 complete (database, stores, UI shell)

## Tasks

### 2.1 Task Data Model
- [ ] Finalize Task TypeScript interface
- [ ] Implement RecurrenceRule type
- [ ] Create task validation helpers
- [ ] Add task sorting utilities (by due date, priority, etc.)

### 2.2 Task CRUD Operations
- [ ] Create task (with all fields)
- [ ] Read task (single and batch)
- [ ] Update task (partial updates)
- [ ] Delete task (with subtask handling)
- [ ] Toggle task completion
- [ ] Implement optimistic updates in Zustand

### 2.3 Subtask Support
- [ ] Create subtask under parent
- [ ] Display nested subtasks (unlimited depth)
- [ ] Indent/outdent subtasks
- [ ] Move subtask to different parent
- [ ] Cascade completion (option to complete subtasks when parent completes)
- [ ] Cascade deletion

### 2.4 List Management
- [ ] Create new list
- [ ] Rename list
- [ ] Delete list (with task handling - move to Inbox or delete)
- [ ] Reorder lists
- [ ] Set list color
- [ ] Display lists in sidebar

### 2.5 Today View
- [ ] Query tasks due today
- [ ] Include overdue tasks
- [ ] Group by list or flat view
- [ ] Quick-add task (defaults to today)
- [ ] Mark tasks complete inline

### 2.6 Inbox View
- [ ] Query tasks without a list (or in default Inbox list)
- [ ] Quick-add task to Inbox
- [ ] Drag task to list in sidebar
- [ ] Bulk actions (move, delete)

### 2.7 Task Details Panel
- [ ] Display all task fields
- [ ] Inline editing for all fields
- [ ] Due date picker
- [ ] Priority selector
- [ ] Tag editor (add/remove tags)
- [ ] Notes editor (rich text or markdown)
- [ ] Time estimate input
- [ ] Display subtasks

### 2.8 Search and Filtering
- [ ] Search tasks by title/description
- [ ] Filter by completion status
- [ ] Filter by priority
- [ ] Filter by tags
- [ ] Filter by due date range

## Deliverables

By the end of Phase 2:
- ✅ Create tasks with all fields
- ✅ Edit and delete tasks
- ✅ Unlimited nested subtasks working
- ✅ Multiple lists with CRUD operations
- ✅ Today view showing today's and overdue tasks
- ✅ Inbox view for unassigned tasks
- ✅ Task details panel with full editing
- ✅ Basic search functionality

## Technical Notes

### Task Component Hierarchy

```
TaskList
├── TaskItem
│   ├── TaskCheckbox
│   ├── TaskTitle
│   ├── TaskMeta (due date, priority badge)
│   ├── SubtaskList (recursive)
│   └── ExpandToggle
└── QuickAddTask
```

### Subtask Data Loading Strategy

For unlimited nesting, use recursive CTE query:

```sql
WITH RECURSIVE subtasks AS (
  SELECT * FROM tasks WHERE parent_id = ?
  UNION ALL
  SELECT t.* FROM tasks t
  JOIN subtasks s ON t.parent_id = s.id
)
SELECT * FROM subtasks ORDER BY created_at;
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `n` | New task |
| `Enter` | Edit selected task |
| `Space` | Toggle completion |
| `Tab` | Indent (make subtask) |
| `Shift+Tab` | Outdent |
| `Delete` | Delete task |
| `Cmd/Ctrl+F` | Focus search |
