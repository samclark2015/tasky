# Sync

Tasky can sync tasks bidirectionally with **CalDAV** servers and **GitHub Issues**. CalDAV servers also provide read-only calendar events for the Calendar view.

---

## CalDAV Sync

CalDAV sync stores tasks as VTODO items on any standards-compliant CalDAV server (Nextcloud, Apple Calendar Server, Fastmail, etc.).

### Setup

1. Open **Settings** (gear icon in the sidebar footer).
2. Under **Accounts**, click **Add Account → CalDAV**.
3. Enter your server URL, username, and password.
4. Click **Test Connection** to verify credentials.
5. Click **Discover** to list available calendars.
6. For each calendar, choose one of:
   - **Link to list** — sync tasks bidirectionally with a task list
   - **Events only** — import calendar events (VEVENTs) into the Calendar view without task sync
   - Leave unlinked to ignore that calendar
7. Click **Save**.

### What Syncs

- Task title, description, due date, priority, tags, recurrence, notes, time estimate, completion status
- Custom Tasky fields are preserved as `X-TASKY-*` properties in the iCal data so other clients can coexist

---

## GitHub Issues Sync

GitHub sync treats Issues as tasks. Each linked repository corresponds to one task list.

### Setup

1. Open **Settings → Accounts → Add Account → GitHub**.
2. Enter a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope.
3. Click **Connect** to verify the token.
4. Click **Discover** to list your repositories.
5. For each repository, optionally **Link to list** and configure:
   - **Query** — the GitHub search query used to fetch issues (default: `assignee:@me is:open`). The repo scope is added automatically.
   - **Read-only** — fetch issues but don't push task changes back to GitHub.
6. Click **Save**.

### What Syncs

| Task field | GitHub mapping |
|---|---|
| Title | Issue title |
| Description | Issue body |
| Tags | Labels |
| Notes | Separated from body by `---` |
| Completion | Closes / reopens the issue |

Fields with no GitHub equivalent (due date, priority, recurrence, time estimate) are not synced.

---

## Auto-Sync

Configure how often Tasky syncs automatically in **Settings → Auto-sync interval**:

| Option | Behavior |
|---|---|
| Off | No automatic sync |
| 5 min | Sync every 5 minutes |
| 15 min | Sync every 15 minutes |
| 30 min | Sync every 30 minutes |
| 60 min | Sync every hour |

Tasky also triggers a debounced sync ~30 seconds after you make changes to tasks that are linked to a sync provider.

## Manual Sync

Click the **Sync** button at the bottom of the sidebar to trigger an immediate sync of all accounts. The button shows the current sync status.

## Sync Status

A status banner appears at the top of Settings when sync is in progress or if an error occurred.
