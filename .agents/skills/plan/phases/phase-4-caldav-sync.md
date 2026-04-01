# Phase 4: CalDAV Sync

**Duration:** Week 4-5  
**Goal:** Implement two-way sync with CalDAV servers

## Objectives

1. Build CalDAV client library
2. Implement server connection and authentication
3. Discover calendars and map to lists
4. Sync tasks bidirectionally
5. Handle conflicts with last-write-wins

## Dependencies

- Phase 2 complete (task CRUD)
- Phase 3 complete (recurrence support for RRULE sync)

## Tasks

### 4.1 CalDAV Client Library
- [ ] Create `packages/caldav` package
- [ ] Implement HTTP client with Basic Auth
- [ ] PROPFIND requests (discovery)
- [ ] REPORT requests (sync collection)
- [ ] GET/PUT/DELETE for individual resources
- [ ] Parse and generate iCalendar (VTODO) format
- [ ] Handle ETags for conflict detection

### 4.2 Server Connection UI
- [ ] Settings page for CalDAV accounts
- [ ] Add account form:
  - [ ] Server URL
  - [ ] Username
  - [ ] Password
- [ ] Test connection button
- [ ] Store credentials securely (Tauri secure storage)
- [ ] Display connection status

### 4.3 Calendar Discovery
- [ ] Discover principal URL
- [ ] Discover calendar-home-set
- [ ] List available calendars
- [ ] Filter to calendars supporting VTODO
- [ ] **Also surface calendars supporting VEVENT** (may overlap; same calendar can hold both)
- [ ] Map CalDAV calendars to local lists
- [ ] Create local list for each calendar
- [ ] Handle calendar colors and names

### 4.4 Task Sync: Local → Remote
- [ ] Convert Task to VTODO format
- [ ] Map all fields:
  - [ ] SUMMARY ↔ title
  - [ ] DESCRIPTION ↔ description
  - [ ] DUE ↔ dueDate
  - [ ] PRIORITY ↔ priority
  - [ ] CATEGORIES ↔ tags
  - [ ] RRULE ↔ recurrence
  - [ ] STATUS ↔ completed
  - [ ] RELATED-TO ↔ parentId (subtasks)
  - [ ] X-TASKY-SOURCE-EVENT-UID ↔ sourceEventUid (for promoted events)
- [ ] Create new task on server (PUT)
- [ ] Update existing task (PUT with ETag)
- [ ] Delete task on server (DELETE)

### 4.5 Task Sync: Remote → Local
- [ ] Fetch changes via sync-collection REPORT
- [ ] Parse VTODO to Task
- [ ] Create new local tasks
- [ ] Update existing local tasks
- [ ] Delete local tasks removed from server
- [ ] Handle tasks not in local database

### 4.5b Calendar Event Fetch (VEVENT, read-only)
- [ ] `caldav_fetch_events` Rust command: REPORT with VEVENT component filter for a date range
- [ ] Parse VEVENT fields: UID, SUMMARY, DTSTART, DTEND/DURATION, DESCRIPTION, LOCATION, COLOR
- [ ] Return `Vec<CalendarEvent>` to frontend (not persisted to SQLite)
- [ ] Frontend fetches events whenever visible date range changes (calendar view navigation)
- [ ] Events stored in a dedicated Zustand `events` store slice (keyed by calendarHref + uid)
- [ ] CalendarEvent → FullCalendar EventInput mapping with `extendedProps.type = 'event'`
- [ ] Events are non-editable/non-draggable on the calendar
- [ ] Per-account/per-calendar visibility toggle persisted to localStorage

### 4.6 Sync Engine
- [ ] Track sync status per task (synced, pending, conflict)
- [ ] Queue pending changes
- [ ] Sync on app launch
- [ ] Periodic background sync
- [ ] Manual sync trigger
- [ ] Sync status indicator in UI

### 4.7 Conflict Resolution
- [ ] Detect conflicts via ETag mismatch
- [ ] Implement last-write-wins:
  - [ ] Compare updatedAt timestamps
  - [ ] Keep newer version
  - [ ] Log conflict for debugging
- [ ] Update ETag after resolution

### 4.8 Offline Handling
- [ ] Queue changes when offline
- [ ] Detect online/offline status
- [ ] Sync queued changes when back online
- [ ] Show offline indicator

## Deliverables

By the end of Phase 4:
- ✅ Connect to CalDAV server (Fastmail, iCloud, etc.)
- ✅ Calendars auto-discovered and shown as lists
- ✅ Tasks sync from local to server
- ✅ Tasks sync from server to local
- ✅ Conflicts resolved automatically
- ✅ Works offline with sync on reconnect
- [ ] Calendar events (VEVENTs) fetched and displayed read-only on calendar view
- [ ] "Add to Tasks" promotes a calendar event to a task that syncs back as VTODO

## Technical Notes

### CalDAV Request Examples

**Discovery (PROPFIND):**
```xml
<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>
```

**VTODO Format:**
```
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:task-123@tasky
SUMMARY:Complete project proposal
DESCRIPTION:Write and submit the Q2 proposal
DUE:20260401T170000Z
PRIORITY:1
CATEGORIES:work,urgent
STATUS:NEEDS-ACTION
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VTODO
END:VCALENDAR
```

### Sync Flow

```
┌─────────────┐                    ┌─────────────┐
│   Local     │                    │   CalDAV    │
│   SQLite    │                    │   Server    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. Check for local changes      │
       │  (sync_status = 'pending')       │
       │                                  │
       │  2. Push local changes ─────────►│
       │     PUT /calendar/task.ics       │
       │                                  │
       │  3. Fetch remote changes ◄───────│
       │     REPORT sync-collection       │
       │                                  │
       │  4. Apply remote changes         │
       │     (create/update/delete)       │
       │                                  │
       │  5. Update ETags and status      │
       ▼                                  ▼
```

### Provider-Specific Notes

| Provider | Principal URL Pattern |
|----------|----------------------|
| Fastmail | `https://caldav.fastmail.com/dav/principals/user/{email}/` |
| iCloud | `https://caldav.icloud.com/` (requires app-specific password) |
| Nextcloud | `https://{server}/remote.php/dav/principals/users/{user}/` |
| Generic | Try `/.well-known/caldav` discovery |

### VEVENT Fetching Notes

- Use a REPORT request with `<comp-filter name="VEVENT"/>` to fetch only events (separate from VTODO sync)
- Fetch is scoped to the visible date range (`<time-range start="..." end="..."/>`) to avoid pulling entire calendar history
- VEVENTs are **never** written back to the server (read-only); only promoted VTODOs are written
- `caldav_fetch_events` command accepts `(account_id, calendar_href, range_start, range_end)` and returns `Vec<CalendarEvent>`
- Recurring VEVENTs: expand instances server-side via `<expand start="..." end="..."/>` in the REPORT so the frontend receives concrete occurrences, not RRULEs
- `sourceEventUid` on a promoted Task is stored locally as `source_event_uid TEXT` column and serialized as `X-TASKY-SOURCE-EVENT-UID` in VTODO for round-trip fidelity
- Deduplication: before showing "Add to Tasks", query local tasks for `source_event_uid = event.uid`; if found, show "Already a task" with a link to it
