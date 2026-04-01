# Phase 3: Calendar & Planner Views

**Duration:** Week 3-4  
**Goal:** Implement Calendar view, Planner view with drag-to-schedule, and recurrence

## Objectives

1. Integrate FullCalendar for calendar visualization
2. Build Calendar view with day/week/month modes
3. Create Planner view with agenda layout
4. Implement drag-to-schedule functionality
5. Add recurrence rule support

## Dependencies

- Phase 2 complete (task CRUD, basic views)

## Tasks

### 3.1 FullCalendar Integration
- [ ] Install @fullcalendar/react and plugins
- [ ] Configure calendar theme to match app design
- [ ] Set up event sources from task store
- [ ] Handle calendar event clicks (select task)
- [ ] Configure drag-and-drop plugins

### 3.2 Calendar View
- [ ] Day view
- [ ] Week view  
- [ ] Month view
- [ ] View switcher UI
- [ ] Navigate between dates
- [ ] Today button
- [ ] Display tasks as events (based on due date)
- [ ] Color-code by list or priority
- [ ] Click task to open details panel
- [ ] Create task on date click
- [ ] Display read-only CalDAV calendar events (VEVENT) alongside tasks
- [ ] Visually distinguish calendar events from tasks (different style/badge)
- [ ] Calendar visibility toggles per-calendar in sidebar or toolbar
- [ ] Click calendar event to open event detail popover (title, time, calendar, description)
- [ ] "Add to Tasks" action on event detail popover to promote event to a task
- [ ] Promoted task pre-fills title, due date/time, notes from VEVENT data
- [ ] Promoted task syncs back to CalDAV as a VTODO linked to the originating calendar

### 3.3 Planner View
- [ ] Vertical timeline layout (today → future)
- [ ] Group tasks by date
- [ ] Show time blocks based on estimates
- [ ] Unscheduled tasks section
- [ ] Current time indicator

### 3.4 Drag-to-Schedule
- [ ] Drag task to specific time slot
- [ ] Update task due date/time on drop
- [ ] Drag to resize (adjust time estimate)
- [ ] Drag from unscheduled to scheduled
- [ ] Drag to reorder within same day
- [ ] Visual feedback during drag

### 3.5 Time Estimation
- [ ] Time estimate input (minutes/hours)
- [ ] Display estimate on task
- [ ] Show total estimated time per day
- [ ] Warn if day is over-scheduled

### 3.6 Recurrence Support
- [ ] RecurrenceRule type (following iCalendar RRULE)
- [ ] Recurrence options:
  - [ ] None
  - [ ] Daily
  - [ ] Weekly (with day selection)
  - [ ] Monthly (by date or day-of-week)
  - [ ] Yearly
  - [ ] Custom (interval, count, until)
- [ ] Recurrence editor UI
- [ ] Generate recurring task instances
- [ ] Complete single instance vs entire series
- [ ] Edit single instance vs entire series

### 3.7 Task Time Tracking
- [ ] Log time spent on task
- [ ] Start/stop timer
- [ ] Manual time entry
- [ ] Display time spent vs estimated

### 3.8 Calendar Event Display & Promote-to-Task
- [ ] Fetch VEVENTs from CalDAV calendars (read-only) alongside VTODOs
- [ ] Store fetched events transiently (in-memory / separate store slice); do not persist as tasks
- [ ] Render VEVENT events on FullCalendar in a visually distinct style (e.g., striped background, "event" badge)
- [ ] Per-calendar visibility toggle in sidebar or calendar toolbar (hide/show individual calendars)
- [ ] Event detail popover on click:
  - Title, date/time range, calendar name, description
  - "Add to Tasks" button (primary CTA)
  - "Open in Calendar" link (future: deep-link to system calendar app)
- [ ] "Add to Tasks" flow:
  - Opens TaskModal pre-filled from VEVENT (title → SUMMARY, dueDate → DTSTART, notes → DESCRIPTION)
  - User picks target list; defaults to the list linked to the originating CalDAV calendar
  - On save, task is created locally and marked `syncStatus: 'pending'` so it syncs as VTODO
  - Original VEVENT is not modified on the server (tasks are additive)
  - Promoted task stores `sourceEventUid` referencing the originating VEVENT UID for deduplication

## Deliverables

By the end of Phase 3:
- ✅ Calendar view with day/week/month
- ✅ Planner view with vertical agenda
- ✅ Drag-and-drop scheduling working
- ✅ Time estimates display correctly
- ✅ Recurring tasks create future instances
- ✅ Basic time tracking
- [ ] CalDAV calendar events (VEVENTs) displayed on calendar view
- [ ] Calendar visibility toggles per-calendar
- [ ] Event detail popover with "Add to Tasks" action
- [ ] Promoted task pre-filled from event data and syncs back as VTODO

## Technical Notes

### FullCalendar Configuration

```typescript
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const calendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  editable: true,
  droppable: true,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  dateClick: handleDateClick,
  eventClick: handleEventClick,
};
```

### Recurrence Rule Structure

```typescript
interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;        // Every N periods
  byDay?: string[];        // ['MO', 'WE', 'FR']
  byMonthDay?: number[];   // [1, 15]
  byMonth?: number[];      // [1, 6, 12]
  count?: number;          // Stop after N occurrences
  until?: Date;            // Stop after this date
}
```

### Planner View Layout

```
┌─────────────────────────────────────┐
│ Today - March 31                    │
├─────────────────────────────────────┤
│ 9:00  ┌──────────────────────┐     │
│       │ Task A (1h)          │     │
│ 10:00 └──────────────────────┘     │
│       ┌──────────────────────┐     │
│       │ Task B (30m)         │     │
│ 10:30 └──────────────────────┘     │
│ ...                                 │
├─────────────────────────────────────┤
│ Tomorrow - April 1                  │
├─────────────────────────────────────┤
│ ...                                 │
└─────────────────────────────────────┘
│ Unscheduled                         │
│ • Task X                            │
│ • Task Y                            │
└─────────────────────────────────────┘
```

### Calendar Event (VEVENT) Data Flow

```
CalDAV Server
    │  REPORT (VEVENT component filter)
    ▼
Rust caldav_fetch_events command
    │  Vec<CalendarEvent>
    ▼
Frontend events store (in-memory, not persisted)
    │  mapped to FullCalendar EventInput with extendedProps.type = 'event'
    ▼
FullCalendar renders both tasks (type='task') and events (type='event')
    │  eventClick dispatcher checks type
    ├─ type='task'  → open DetailsPanel (existing)
    └─ type='event' → open EventDetailPopover
                          │ "Add to Tasks" clicked
                          ▼
                      TaskModal (pre-filled)
                          │ saved
                          ▼
                      Task created with sourceEventUid
                      syncStatus='pending' → next CalDAV sync pushes as VTODO
```

### CalendarEvent Type

```typescript
interface CalendarEvent {
  uid: string;
  calendarHref: string;    // Which CalDAV calendar it came from
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  description: string;
  location: string | null;
  color: string | null;    // From VEVENT COLOR or calendar color
}
```

### Task sourceEventUid Field

- Added to `Task` type as optional `sourceEventUid: string | null`
- Prevents duplicate promotions: if `sourceEventUid` already exists for a given UID, "Add to Tasks" shows "Already added" state in the popover
- Not synced to CalDAV (Tasky-internal field stored as `X-TASKY-SOURCE-EVENT-UID` for round-tripping)
