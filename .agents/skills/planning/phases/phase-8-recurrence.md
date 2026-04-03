# Phase 8: Recurrence Feature Completion

**Duration:** 3–5 sessions  
**Goal:** Make recurring tasks fully functional end-to-end — completing a recurring task auto-schedules the next instance, future occurrences are visible in the Calendar and Planner, and monthly recurrence has a proper day-of-month UI.

---

## Objectives

1. Build a recurrence utility library (`src/lib/recurrence.ts`) for computing occurrence dates
2. Auto-generate the next task instance when a recurring task is completed
3. Surface virtual (projected) occurrences in CalendarView via the FullCalendar rrule plugin
4. Surface virtual occurrences in PlannerView via manual expansion
5. Add `byMonthDay` UI to `RecurrenceEditor` for monthly tasks

---

## Dependencies

- All prior phases complete (✅ Phase 1–7)
- Understanding of `RecurrenceRule` type in `src/types/types.ts`
- Understanding of `toggleComplete` in `src/stores/tasks.ts`
- Understanding of `CalendarView` in `src/views/calendar/index.tsx`
- Understanding of `PlannerView` in `src/views/planner/index.tsx`
- Understanding of `RecurrenceEditor` in `src/components/task/recurrence-editor.tsx`

---

## Tasks

### 8.1 Recurrence Utility Library

**File:** `src/lib/recurrence.ts` (new file)

- [ ] `nextOccurrence(rule, anchor, after): Date | null`
  - `daily`: advance `interval` days from `after`
  - `weekly` without `byDay`: advance `interval * 7` days
  - `weekly` with `byDay`: find the next RFC 5545 weekday in `byDay` after `after`; wrap to next week if needed; respect `interval` (skip non-multiple weeks)
  - `monthly`: advance `interval` months; if `byMonthDay` set, use the first value as the day-of-month
  - `yearly`: advance `interval` years
  - Enforce `until`: return `null` if next date is after `until`
  - `count` enforcement: accept optional `completedCount` parameter; return `null` if `completedCount >= count`
- [ ] `getOccurrencesBetween(rule, anchor, rangeStart, rangeEnd): Date[]`
  - Start from `anchor`, step via `nextOccurrence` until past `rangeEnd` or termination reached
  - Return all occurrence dates that fall within `[rangeStart, rangeEnd]`
  - Cap at a reasonable max (e.g. 500 iterations) to avoid infinite loops
- [ ] Unit tests in `src/lib/recurrence.test.ts`
  - Daily, weekly (with/without byDay), monthly, yearly
  - `until` termination, `count` termination
  - Edge: interval > 1, multiple byDay values, byMonthDay
  - `getOccurrencesBetween` for a 14-day and 30-day window

**Acceptance criteria:** All tests pass (`pnpm test`).

---

### 8.2 Schema Extension: `recurrenceChainId`

**Purpose:** Links all instances of a recurring series together (original + all auto-spawned tasks). Required for `count`-based termination and future "edit all instances" feature.

- [ ] Add `recurrence_chain_id TEXT` column to `tasks` table — **migration v11** in `src/db/migrations/index.ts`
  ```sql
  ALTER TABLE tasks ADD COLUMN recurrence_chain_id TEXT;
  CREATE INDEX idx_tasks_recurrence_chain_id ON tasks(recurrence_chain_id);
  ```
- [ ] Add `recurrenceChainId: string | null` to `Task` interface in `src/types/types.ts`
- [ ] Update `repository.ts`:
  - `rowToTask`: map `row.recurrence_chain_id → task.recurrenceChainId`
  - `createTask`: insert `recurrence_chain_id`
  - `updateTask`: include `recurrence_chain_id` in patch builder
- [ ] Update `app_sync/bundle.rs`: add `recurrence_chain_id: Option<String>` to `BundleTask` struct
- [ ] Update `app_sync/db.rs`: read/write the new column in bundle read/write logic

**Acceptance criteria:** `pnpm typecheck` clean; new column present after migration; app launches without error.

---

### 8.3 Next-Instance Generation on Completion

**File:** `src/stores/tasks.ts`

- [ ] Modify `toggleComplete(adapter, id)`:
  1. Fetch the task; flip `completed`/`completedAt` as today
  2. **If marking complete AND task has `recurrence`:**
     a. Count completed tasks in the same `recurrenceChainId` (query DB or count from in-memory store) — used for `count` enforcement
     b. Call `nextOccurrence(rule, anchor, completedAt)` where `anchor` = the task's original `dueDate`
     c. If `nextOccurrence` returns a date: call `createTask(adapter, { ...clonedFields, dueDate: nextDate, completed: false, completedAt: null, recurrenceChainId: task.recurrenceChainId ?? task.id })`
     - Cloned fields: `title`, `description`, `listId`, `priority`, `tags`, `recurrence`, `timeEstimate`, `notes`
     - **Not cloned:** `id` (new UUID), `parentId` (not a subtask of the original), `remoteId`, `etag`, `sourceEventUid`, `completedAt`
     - Set `syncStatus: 'pending'` on new task
  3. If marking **incomplete** (un-complete): no recurrence logic — just flip the flag

**Acceptance criteria:**
- Completing a daily recurring task creates a new task due tomorrow
- Completing a weekly recurring task (Mon/Wed/Fri) creates one due on the correct next weekday
- A task with `until` in the past does not create a new instance
- Un-completing a recurring task does not create new instances

---

### 8.4 Virtual Occurrences in CalendarView

**Approach:** Install the FullCalendar rrule plugin. For recurring tasks that have a `recurrence` rule and a `dueDate` (the series anchor), pass an event with an `rrule` property instead of a single date. FullCalendar handles expansion automatically.

**Files:** `src/views/calendar/index.tsx`, `package.json`

- [ ] Install packages:
  ```
  pnpm add @fullcalendar/rrule rrule
  ```
- [ ] Register `rrulePlugin` in the FullCalendar `plugins` array
- [ ] In the event mapping function (where tasks are converted to FullCalendar events):
  - If `task.recurrence && task.dueDate`:
    - Build an RRULE string using the existing `rruleToString()` from `sync.ts` — **extract it to `src/lib/recurrence.ts`** or duplicate locally
    - Pass event as:
      ```typescript
      {
        id: task.id,
        title: task.title,
        rrule: { dtstart: task.dueDate, freq: ..., ...parsed from RecurrenceRule },
        // or: rrule: `DTSTART:${dtstart}\nRRULE:${rruleString}`
        duration: task.timeEstimate ? `${Math.floor(task.timeEstimate/60)}:${String(task.timeEstimate%60).padStart(2,'0')}` : '00:30',
        extendedProps: { type: 'task', taskId: task.id, isRecurring: true }
      }
      ```
  - Non-recurring tasks: existing logic unchanged
- [ ] Style recurring event instances distinctly (e.g. dashed border or small recurrence icon in title) — apply via `eventClassNames` or title prefix
- [ ] Clicking a recurring event instance opens the **base task** in details panel (use `taskId` from `extendedProps`)
- [ ] Completed task instances: exclude from rrule event (the completed row is already shown as a regular non-repeating event); OR filter completed recurring tasks from the rrule path

**Note:** FullCalendar's rrule plugin requires the `rrule` npm package as a peer dep. The event `rrule` property accepts either an RRULE string (with `DTSTART:` prefix) or an object matching the `rrule` library's options. The string form is simplest.

**Acceptance criteria:**
- A weekly Mon/Wed/Fri task shows as 3 events per week in the calendar
- A monthly task shows once per month
- Clicking any instance opens the base task details
- Non-recurring tasks are unaffected

---

### 8.5 Virtual Occurrences in PlannerView

**File:** `src/views/planner/index.tsx`

The planner shows a 14-day rolling window. We need to inject virtual occurrences alongside real tasks.

- [ ] Import `getOccurrencesBetween` from `src/lib/recurrence.ts`
- [ ] Define a `VirtualTaskOccurrence` type:
  ```typescript
  type VirtualTaskOccurrence = Task & { isVirtual: true }
  ```
- [ ] Before building the day groups, compute virtual occurrences:
  ```typescript
  const windowStart = today
  const windowEnd = addDays(today, DAYS_AHEAD)
  
  const virtualOccurrences: VirtualTaskOccurrence[] = []
  for (const task of allTasks) {
    if (!task.recurrence || !task.dueDate || task.completed) continue
    const occurrences = getOccurrencesBetween(task.recurrence, parseDate(task.dueDate), windowStart, windowEnd)
    for (const date of occurrences) {
      // Skip the base task's own due date (already shown as real task)
      if (isSameDay(date, parseDate(task.dueDate))) continue
      virtualOccurrences.push({ ...task, id: `${task.id}-virtual-${date.toISOString()}`, dueDate: date.toISOString(), isVirtual: true })
    }
  }
  ```
- [ ] Merge virtual occurrences into the day group data structure (alongside real tasks, sorted by dueDate)
- [ ] In the `TaskItem` rendered for a virtual occurrence: pass a prop or wrap to show it as non-interactive (read-only preview)
  - Simplest: render as a slightly dimmed `TaskItem` with `pointer-events: none`
  - Or: don't use `TaskItem` — render a simpler read-only row with a recurrence indicator (↻ icon)
- [ ] The time estimate total for each day should include virtual occurrences

**Acceptance criteria:**
- A task recurring every weekday appears in each of the next 14 weekdays in the planner (excluding the base task's own date, which is already shown)
- Virtual occurrences are visually distinct (dimmed or labeled "recurring")
- Real task for "today" still shows normally

---

### 8.6 `byMonthDay` UI in RecurrenceEditor

**File:** `src/components/task/recurrence-editor.tsx`

- [ ] When `freq === 'monthly'`, show a "Day of month" input below the interval/frequency row:
  - Label: "On day"
  - Number input: min=1, max=31
  - Default: the task's current due date day-of-month (if available), else 1
  - Value stored as `byMonthDay: [selectedDay]` (single-element array for now)
  - Clearing the input (or setting to 0) removes `byMonthDay` from the rule
- [ ] When changing `freq` away from `monthly`: clear `byMonthDay`
- [ ] When setting `freq` to `monthly`: pre-fill `byMonthDay` from the due date if available (pass `defaultDayOfMonth?: number` prop or derive from parent)

**Component prop change:**
```typescript
interface RecurrenceEditorProps {
  value: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
  className?: string
  defaultDayOfMonth?: number  // NEW: from task dueDate
}
```

Update both call sites (`task-modal.tsx`, `details-panel.tsx`) to pass `defaultDayOfMonth` from the task's due date.

**Acceptance criteria:**
- A monthly task shows the "On day" input when `freq === 'monthly'`
- Changing the day input updates the recurrence rule in the parent
- CalDAV round-trip: a task with `byMonthDay: [15]` serializes to `FREQ=MONTHLY;BYMONTHDAY=15` and deserializes correctly

---

## Deliverables

At the end of Phase 8:

- `src/lib/recurrence.ts` — `nextOccurrence` + `getOccurrencesBetween` with full test coverage
- DB migration v11 — `recurrence_chain_id` column
- Completing a recurring task spawns the correct next instance automatically
- Calendar view shows all future occurrences of recurring tasks as projected events
- Planner view shows virtual occurrences in the 14-day window
- Monthly recurring tasks can specify day-of-month in the UI
- `pnpm typecheck` and `pnpm test` both pass clean

---

## Technical Notes

### RRULE string format for FullCalendar

FullCalendar's rrule plugin accepts a combined string with `DTSTART` and `RRULE`:
```
DTSTART:20260401T090000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
```
Use the existing `rruleToString()` helper (move to `recurrence.ts`) for the `RRULE` part. For `DTSTART`, format the task's `dueDate` as a UTC datetime string.

The plugin also accepts an object matching the `rrule` npm package's `Options` interface — this may be cleaner to construct programmatically.

### Weekday arithmetic for `byDay`

RFC 5545 weekday codes map to JS `Date.getDay()` values:
```
SU=0, MO=1, TU=2, WE=3, TH=4, FR=5, SA=6
```
For `nextOccurrence` with `byDay`, find all weekdays in the current week (starting from `after + 1 day`) that are in the `byDay` list. If none found in this week, jump `interval` weeks and find the first matching weekday.

### `until` date format mismatch

`RecurrenceRule.until` can arrive from CalDAV as a compact datetime string (`20251231T235959Z`) rather than `YYYY-MM-DD`. The `nextOccurrence` function must handle both forms. Use `new Date(until)` — works for both ISO-8601 formats.

### Avoiding double-display in CalendarView

When a recurring task is treated as an rrule event, FullCalendar will render an instance on the base task's `dueDate` too. Do NOT additionally render that task as a regular single event — use the rrule path exclusively for recurring tasks. Completed recurring tasks (individual instances) can be fetched from the store and rendered as regular completed events (non-repeating).

### Virtual vs. real tasks in PlannerView

Assign virtual occurrence IDs as `${task.id}-virtual-${dateString}`. These IDs will never collide with real task UUIDs (UUIDs don't contain `-virtual-`). The `isVirtual` flag prevents `toggleComplete` from being called on them.

### count enforcement in `toggleComplete`

To count completed instances in a chain without a DB query, iterate the in-memory `tasks` Map and count tasks where `recurrenceChainId === task.recurrenceChainId && completed === true`. This is O(n) but acceptable given typical task counts.

### CalDAV compatibility

The new `recurrence_chain_id` column is a Tasky-internal field only. It is **not** synced to CalDAV (no corresponding RRULE/X-TASKY property). Each spawned task is an independent VTODO on the CalDAV server. This is consistent with how most CalDAV clients handle completed VTODO recurrences.
