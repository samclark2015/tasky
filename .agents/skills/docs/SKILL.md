---
name: docs
description: User-facing documentation for Tasky. Load when writing, reviewing, or updating docs after feature changes.
---

# Skill: Tasky Documentation

## Purpose

This skill governs the user-facing documentation for Tasky. It defines what to document, where docs live, the content structure for each file, and a maintenance protocol for keeping docs accurate after feature changes.

---

## Documentation Location

All user-facing docs live in `docs/` at the project root:

```
docs/
├── getting-started.md       - Installation and first run
├── task-management.md       - Creating and managing tasks, all fields
├── views.md                 - Today, Inbox, Lists, Calendar, Planner, Search
├── sync.md                  - CalDAV and GitHub Issues sync setup
├── keyboard-shortcuts.md    - Complete shortcut reference
└── settings.md              - Theme, auto-sync, and account management
```

---

## Maintenance Protocol

### When to Update Docs

Update the relevant doc file **immediately after** any user-visible change lands. Use this table to identify which files are affected:

| Change type | Files to update |
|---|---|
| New view added to sidebar | `views.md`, `keyboard-shortcuts.md` (if shortcut added), `getting-started.md` if it affects first-run experience |
| New task field | `task-management.md` |
| Keyboard shortcut added, changed, or removed | `keyboard-shortcuts.md` |
| New or changed sync provider | `sync.md` |
| New settings option | `settings.md` |
| UI label / button rename | Search all docs for old label; update every occurrence |
| Feature removed or deprecated | Remove the section; add a brief migration note if users need to do anything |
| Install method changes | `getting-started.md` |
| First-run experience changes | `getting-started.md` |

### After a Major Feature Release

Run through this checklist before closing the task:

- [ ] Read the diff / PR to identify all user-visible changes
- [ ] Update each affected doc file using the table above
- [ ] Re-read `getting-started.md` end-to-end — is first-run still accurate?
- [ ] Verify every keyboard shortcut in `keyboard-shortcuts.md` matches `src/App.tsx`
- [ ] Confirm all UI labels (button text, menu items, field names) match what's in the code
- [ ] If a new view was added, check that `views.md` and the sidebar description are consistent

---

## Style Guide

- **Voice:** Second person or imperative. "You can..." / "Click..." / "Press..."
- **Tone:** Plain, direct, no marketing. Describe what the app does, not how great it is.
- **Structure:** `##` for top-level sections, `###` for subsections. One concept per section.
- **Reference tables:** Use tables for keyboard shortcuts, settings, and field listings.
- **Formatting:** Keyboard keys in backticks: `Cmd+N`. UI labels in backticks: `Due date`. File paths in backticks.
- **Length:** Keep sections short. If a section grows beyond ~10 lines of prose, split it.

---

## File Responsibilities

### getting-started.md

What it must cover:
- One-sentence description of Tasky
- How to install / download
- What you see on first launch (sidebar, views, empty state)
- How to create the first task

Update triggers: install method changes, first-run UX changes, major navigation changes.

---

### task-management.md

What it must cover:
- How to create a task (keyboard shortcut, QuickAdd, modal)
- All task fields with a brief description of each: title, description, due date, time, all-day toggle, priority (low/medium/high), list, time estimate, tags, recurrence, notes
- Subtasks: how to create, how they nest, subtask progress count
- Completing tasks (click the circle)
- Recurring tasks: what recurrence does, how to configure it (freq, interval, days, end condition)
- Deleting tasks (right-click context menu or Details panel delete button)

Update triggers: new task field added, field renamed or removed, recurrence behavior changes, subtask behavior changes.

---

### views.md

What it must cover, with a `###` section per view:

| View | Key behavior to document |
|---|---|
| **Today** | Shows overdue tasks (red) + tasks due today + completed today; QuickAdd creates with today's date |
| **Inbox** | Tasks with no list assigned; QuickAdd creates unscheduled, unassigned tasks |
| **Lists** | User-created lists with color; how to create, rename, delete a list; tasks scoped to that list |
| **Calendar** | Month/week/day toggle; tasks as events; CalDAV events (read-only or linked); drag to reschedule; click to create |
| **Planner** | 14-day rolling view; collapsible day blocks; time estimate totals; over-scheduling warning (>8h); Unscheduled section |
| **Search** | Real-time search across title, description, notes, tags |

Update triggers: new view added, view renamed, significant behavior change in any view.

---

### sync.md

What it must cover:
- Overview: what sync does (bidirectional for tasks, read-only for calendar events)
- CalDAV setup: step-by-step (Settings → Accounts → Add CalDAV → enter URL/username/password → Test Connection → Discover → link calendars to lists)
- GitHub Issues setup: step-by-step (Settings → Accounts → Add GitHub → enter PAT → connect → discover repos → link repos to lists)
- Read-only mode for GitHub
- Auto-sync: how to configure the interval (Off / 5 / 15 / 30 / 60 min)
- Manual sync: the Sync button in the sidebar footer
- Sync status: what the status banner shows

Update triggers: new sync provider added, setup flow changes, new sync settings.

---

### keyboard-shortcuts.md

What it must cover — a single reference table of all shortcuts. Source of truth is `src/App.tsx`.

Current shortcuts:

| Key | Action |
|---|---|
| `Cmd/Ctrl+F` | Navigate to Search |
| `N` | Open new task modal |
| `Escape` | Deselect task / close details panel |
| `1` | Navigate to Today |
| `2` | Navigate to Inbox |
| `3` | Navigate to Calendar |
| `4` | Navigate to Planner |

Note: shortcuts are suppressed when focus is inside an `<input>`, `<textarea>`, or `<select>`.

Update triggers: **any** change to keyboard shortcuts in `src/App.tsx`. This file should always exactly mirror the code.

---

### settings.md

What it must cover:
- Theme: Light, Dark, System; also accessible via the View menu in the macOS menu bar
- Auto-sync interval: dropdown options (Off, 5, 15, 30, 60 min)
- Sync Now button
- Provider accounts: adding, editing, deleting CalDAV and GitHub accounts
- Linked calendars / repos per account
- CalDAV events-only toggle (link a calendar for event display without task sync)

Update triggers: new settings option, new provider type, settings UI restructure.
