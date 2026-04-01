# Project Documentation Structure

This document describes the planning and documentation structure for Tasky.

## Directory Layout

```
plan/
├── PLAN.md          - Master development plan with tech stack, architecture decisions,
│                      and phase overview
├── PROGRESS.md      - Living document tracking completed work, current status,
│                      and blockers
└── phases/          - Detailed breakdown of each development phase
    ├── phase-1-foundation.md
    ├── phase-2-core-tasks.md
    ├── phase-3-views.md
    ├── phase-4-caldav-sync.md
    └── phase-5-polish.md
```

## How to Use This Structure

### For Development
1. Read `plan/PLAN.md` for overall context and architecture decisions
2. Check `plan/PROGRESS.md` for current status and what to work on next
3. Reference the relevant phase document in `plan/phases/` for detailed requirements

### For Progress Updates
- Update `plan/PROGRESS.md` after completing significant milestones
- Mark tasks as complete with dates
- Note any blockers or scope changes

### Phase Documents
Each phase document contains:
- **Objectives**: High-level goals for the phase
- **Tasks**: Specific implementation tasks with acceptance criteria
- **Dependencies**: What must be complete before starting
- **Deliverables**: What should be working at phase completion
- **Technical Notes**: Implementation guidance and decisions
