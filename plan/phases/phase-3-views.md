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

## Deliverables

By the end of Phase 3:
- ✅ Calendar view with day/week/month
- ✅ Planner view with vertical agenda
- ✅ Drag-and-drop scheduling working
- ✅ Time estimates display correctly
- ✅ Recurring tasks create future instances
- ✅ Basic time tracking

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
