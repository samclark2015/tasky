# Task Management

## Creating Tasks

| Method | How |
|---|---|
| New Task modal | Press `N` or use the `+` button in the modal |
| QuickAdd | Type in the "Add a task..." input at the bottom of a view and press `Enter` |
| Right-click a date in Calendar | Creates a task pre-filled with that date |

## Task Fields

| Field | Description |
|---|---|
| **Title** | Required. The task name. |
| **Description** | Short summary or context. |
| **Due date** | Date and optional time the task is due. Toggle **All day** to remove the time component. |
| **Priority** | `Low`, `Medium` (default), or `High`. Shown as a colored dot on task rows. |
| **List** | Assign the task to a list. Tasks with no list go to Inbox. |
| **Time estimate** | How long the task is expected to take, in hours and minutes. |
| **Tags** | Free-form labels. Separate multiple tags with commas. Tags autocomplete from existing tags across all tasks. |
| **Recurrence** | Make the task repeat. See [Recurring Tasks](#recurring-tasks) below. |
| **Notes** | Long-form text. Separate from description — use for details, links, or context. |

## Completing Tasks

Click the circle to the left of a task title to mark it complete. Click again to uncheck it. Completed tasks move to a "Completed" section at the bottom of the view.

## Subtasks

To add a subtask:
- Hover over a task row and click the **+** icon that appears on the right, or
- Open the task in the Details panel and use the **Add subtask** input.

Subtasks nest under their parent with indentation. The parent task row shows a progress count (e.g. `2/5`). Deleting a parent task deletes all its subtasks.

## Recurring Tasks

Enable recurrence in the task modal or Details panel. Options:

| Setting | Values |
|---|---|
| **Frequency** | Daily, Weekly, Monthly, Yearly |
| **Interval** | Repeat every N periods (e.g. every 2 weeks) |
| **Days** | (Weekly only) Which days of the week |
| **Ends** | Never / After N occurrences / On a specific date |

## Editing Tasks

Click any task to open the **Details panel** on the right. All fields are inline-editable — click a field to edit, press `Enter` or click away to save, press `Escape` to cancel.

For a full-screen form, click the **Edit** button in the Details panel header to open the Task modal.

## Deleting Tasks

Right-click a task and choose **Delete**, or open the task in the Details panel and click the trash icon. A confirmation prompt appears before deletion.

## Right-Click Context Menu

Right-clicking a task gives quick access to:

- Set **Priority** (High / Medium / Low)
- Add or create **Tags**
- **Move to list**
- **Unschedule** (removes due date)
- **Delete**
