# Views

Tasky organizes tasks into several views accessible from the sidebar. Press `1`–`4` to jump to the main views, or `Cmd/Ctrl+F` for Search.

---

## Today

Shows all tasks relevant to the current day, grouped into three sections:

- **Overdue** — tasks with a due date before today (shown with red styling)
- **Due today** — tasks due on the current date
- **Completed today** — tasks completed today

Use the **QuickAdd** input at the bottom to create a task due today.

---

## Inbox

Holds tasks that haven't been assigned to a list. This is the default destination for tasks created without specifying a list.

Sections:
- Active tasks (no due date filter)
- **Completed** — completed inbox tasks

Use **QuickAdd** to create an unscheduled, unassigned task.

---

## Lists

User-created lists appear below the main navigation items in the sidebar. Each list has a name and an optional color dot.

Click a list in the sidebar to switch to its view. The view shows:
- Active tasks in that list
- A **Completed** section

To manage a list, click the `...` button in the list view header to open the list editor (rename, change color, or delete).

### Creating a List

Click the `+` button at the bottom of the sidebar, or use the **New List** option. Give the list a name and pick a color.

### Deleting a List

Open the list editor (`...` button) and click **Delete**. You'll be asked whether to delete all tasks in the list or keep them (they move to Inbox).

---

## Calendar

A full calendar view powered by FullCalendar. Toggle between Month, Week, and Day layouts using the buttons in the view header.

**Tasks** appear as events on the day they're due. Colors come from the task's list color, or priority if no list is assigned (High = red, Medium = yellow, Low = gray).

**CalDAV calendar events** (VEVENTs) also appear if you have sync set up. Use the calendar toggle dropdown in the header to show or hide individual CalDAV calendars.

### Interactions

| Action | Result |
|---|---|
| Click a task event | Opens task Details panel |
| Click a CalDAV event | Opens an event popover with title, time, and an "Add to Tasks" button |
| Click an empty time slot | Opens New Task modal pre-filled with that date/time |
| Drag a task event | Updates the task's due date |
| Resize a task event | Updates due date and time estimate |

The calendar displays the time range 06:00–23:00 with a "now" indicator.

---

## Planner

A 14-day rolling view showing tasks grouped by due date.

Each day shows:
- Day label (Today, Tomorrow, or weekday + date)
- Task count
- Total time estimate for the day
- A warning if the total exceeds 8 hours

Days are collapsible. An **Unscheduled** section at the bottom lists tasks without a due date.

---

## Search

Full-text search across all tasks. The search input is auto-focused when you open the view.

Search matches against: task **title**, **description**, **notes**, and **tags**. Results update as you type (case-insensitive).

Press `Cmd/Ctrl+F` from anywhere in the app to jump to Search.
