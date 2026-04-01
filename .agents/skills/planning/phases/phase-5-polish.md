# Phase 5: Polish & Notifications

**Duration:** Week 5-6  
**Goal:** Final MVP polish, notifications, testing, and builds

## Objectives

1. Implement system notifications for due tasks
2. Comprehensive error handling
3. Unit tests for critical paths
4. Performance optimization
5. Desktop builds for all platforms

## Dependencies

- All previous phases complete

## Tasks

### 5.1 System Notifications
- [ ] Configure Tauri notification plugin
- [ ] Request notification permissions
- [ ] Notification triggers:
  - [ ] Task due now
  - [ ] Task due in X minutes (configurable)
  - [ ] Overdue task reminder
- [ ] Notification content (title, body, actions)
- [ ] Click notification to open task
- [ ] Notification preferences in settings:
  - [ ] Enable/disable
  - [ ] Reminder timing (5min, 15min, 30min, 1hr before)
  - [ ] Quiet hours

### 5.2 Background Task Scheduler
- [ ] Check for upcoming due tasks periodically
- [ ] Schedule notifications for upcoming tasks
- [ ] Reschedule on task update/delete
- [ ] Handle app restart (reschedule all)

### 5.3 Error Handling
- [ ] Global error boundary in React
- [ ] Toast notifications for errors
- [ ] Graceful handling of:
  - [ ] Database errors
  - [ ] Network failures
  - [ ] CalDAV auth failures
  - [ ] Invalid data
- [ ] Error logging (local file)
- [ ] User-friendly error messages

### 5.4 Unit Testing
- [ ] Set up Vitest
- [ ] Test task CRUD operations
- [ ] Test subtask nesting logic
- [ ] Test recurrence rule generation
- [ ] Test VTODO ↔ Task conversion
- [ ] Test sync conflict resolution
- [ ] Test date/time utilities
- [ ] Aim for 70%+ coverage on critical paths

### 5.5 Performance Optimization
- [ ] Profile React renders
- [ ] Virtualize long task lists
- [ ] Optimize SQLite queries
- [ ] Lazy load views
- [ ] Memoize expensive computations
- [ ] Reduce bundle size

### 5.6 UX Polish
- [ ] Loading states for all async operations
- [ ] Empty states for views
- [ ] Keyboard navigation throughout
- [ ] Focus management
- [ ] Smooth animations/transitions
- [ ] Responsive layout refinements

### 5.7 Desktop Builds
- [ ] macOS build (universal binary)
- [ ] Windows build (x64 + ARM)
- [ ] Linux build (AppImage, deb)
- [ ] App icons for all platforms
- [ ] Code signing (macOS)
- [ ] Auto-update configuration
- [ ] Build CI/CD pipeline

### 5.8 Documentation
- [ ] README with setup instructions
- [ ] Architecture overview
- [ ] CalDAV setup guide
- [ ] Keyboard shortcuts reference

## Deliverables

By the end of Phase 5 (MVP Complete):
- ✅ System notifications working
- ✅ Comprehensive error handling
- ✅ Unit tests passing (70%+ coverage on critical code)
- ✅ Smooth, polished UX
- ✅ Downloadable builds for Mac, Windows, Linux
- ✅ Basic documentation

## Technical Notes

### Tauri Notification Setup

```rust
// src-tauri/Cargo.toml
[dependencies]
tauri-plugin-notification = "2"
```

```typescript
// Frontend
import { sendNotification, requestPermission } from '@tauri-apps/plugin-notification';

await requestPermission();

sendNotification({
  title: 'Task Due',
  body: 'Complete project proposal is due in 15 minutes',
});
```

### Notification Scheduler

```typescript
interface ScheduledNotification {
  taskId: string;
  triggerAt: Date;
  type: 'due' | 'reminder';
}

class NotificationScheduler {
  private scheduled: Map<string, NodeJS.Timeout> = new Map();
  
  schedule(task: Task): void {
    // Cancel existing
    this.cancel(task.id);
    
    if (!task.dueDate || task.completed) return;
    
    const reminderTime = subMinutes(task.dueDate, settings.reminderMinutes);
    const now = new Date();
    
    if (reminderTime > now) {
      const timeout = setTimeout(() => {
        this.sendReminder(task);
      }, reminderTime.getTime() - now.getTime());
      
      this.scheduled.set(task.id, timeout);
    }
  }
  
  cancel(taskId: string): void {
    const timeout = this.scheduled.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduled.delete(taskId);
    }
  }
}
```

### Test Structure

```
packages/
├── core/
│   └── src/
│       ├── __tests__/
│       │   ├── tasks.test.ts
│       │   ├── recurrence.test.ts
│       │   └── ...
│       └── ...
├── db/
│   └── src/
│       └── __tests__/
│           └── queries.test.ts
└── caldav/
    └── src/
        └── __tests__/
            ├── parser.test.ts
            └── sync.test.ts
```

### Build Matrix

| Platform | Target | Artifact |
|----------|--------|----------|
| macOS | aarch64-apple-darwin | Tasky.app (universal) |
| macOS | x86_64-apple-darwin | (included in universal) |
| Windows | x86_64-pc-windows-msvc | Tasky_x64.msi |
| Windows | aarch64-pc-windows-msvc | Tasky_arm64.msi |
| Linux | x86_64-unknown-linux-gnu | Tasky.AppImage, tasky.deb |
