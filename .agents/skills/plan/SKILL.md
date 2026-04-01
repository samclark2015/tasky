---
name: Multi-Phase Project Planning
description: Structure a complex software project into a phased plan with a master plan document, a living progress tracker, and per-phase detail files so any agent can understand current state and continue work across sessions.
---

# Skill: Planning a Multi-Phase Software Project

## What This Skill Does

Structures a complex software project into a phased plan with a master plan document, a living progress tracker, and per-phase detail files. Gives any AI agent working on the codebase enough context to understand current state, make good decisions, and continue work across sessions.

## Directory Layout

```
.agents/skills/plan/
├── PLAN.md          - Master plan: tech stack, architecture decisions, data model, phase overview
├── PROGRESS.md      - Living tracker: completed work, current phase, implementation notes, blockers
└── phases/          - One file per phase with full task breakdown and technical guidance
    ├── phase-1-foundation.md
    ├── phase-2-core-tasks.md
    ├── phase-3-views.md
    ├── phase-4-caldav-sync.md
    └── phase-5-polish.md
```

## When to Use This Skill

- Starting a project that will span multiple sessions or agents
- When a project has 3+ distinct phases or areas of work
- When architectural decisions need to be recorded and reasoned about
- When you want consistent handoff context between agent sessions

## How to Apply It

### 1. Write PLAN.md first

Capture the things that don't change often:

- **Overview**: what the app does, target platform, rough timeline
- **Tech stack table**: every layer and what library/framework handles it
- **Architecture decisions**: offline-first vs cloud, auth approach, data model shape — the *why*, not just the *what*
- **Phase overview table**: phase number, name, duration, one-line focus
- **Project structure**: directory tree with annotations
- **Core data model**: key interfaces/structs (the ones that touch every layer)
- **Success criteria**: a checklist for MVP

### 2. Write per-phase files

Each `phases/phase-N-name.md` contains:

- **Duration** and **Goal** in the header
- **Objectives**: 4–6 numbered goals, high-level
- **Dependencies**: what prior phases must be complete
- **Tasks**: grouped sub-sections (e.g. 4.1, 4.2…) with checkbox items and acceptance criteria
- **Deliverables**: bullet list of working outcomes at phase end
- **Technical Notes**: concrete implementation guidance — schema DDL, API shapes, gotchas, provider-specific URLs, example wire formats

The technical notes section is the most valuable part. It should contain anything a fresh agent would need to avoid spending time re-researching.

### 3. Write PROGRESS.md

This is the only file that gets updated as work progresses:

- **Current Status**: current phase, last updated date
- **Phase Completion**: top-level checklist of phases
- **Detailed Progress**: per-phase checkboxes mirroring the phase files, marked as work completes
- **Blockers**: anything currently blocking progress (or "None currently")
- **Notes**: per-phase implementation notes — the real gotchas encountered, workarounds used, decisions made that aren't obvious from the code

Update PROGRESS.md at the end of every significant working session.

## Key Principles

**PLAN.md is stable, PROGRESS.md is living.** Don't edit phase files to reflect completion — check things off in PROGRESS.md instead. Phase files are reference docs; PROGRESS.md is the source of truth for current state.

**Implementation notes are critical.** The most useful thing in PROGRESS.md is the notes section: library-specific API gotchas, which approach was tried and abandoned, non-obvious configuration. Future agents (and humans) waste the most time re-learning things that were already figured out.

**Make phase files independently readable.** Each phase file should be useful without reading the others. Include enough technical context (schema, example formats, API signatures) that an agent dropped into that phase can start working immediately.

**Keep phases small enough to complete.** If a phase would take more than 2 weeks, split it. Phases that are too large are never "done" and the progress tracker becomes inaccurate.

## Example: When an Agent Session Starts

The agent should:

1. Read `PLAN.md` for overall context and architecture decisions
2. Read `PROGRESS.md` to find the current phase and what's already done
3. Read the relevant `phases/phase-N.md` for detailed task breakdown
4. Work through tasks, updating `PROGRESS.md` at the end

## Example: What Goes in Technical Notes (PROGRESS.md)

Good implementation notes record surprising or non-obvious things:

```markdown
### Phase 4 Implementation Notes
- `PutResource::new(href).create(data, content_type)` — data is passed at
  mode selection (.create/.update), NOT to the constructor
- `Delete<WithEtag>` and `Delete<Force>` are distinct Rust types; cannot
  share a match arm — use separate `client.request()` calls in each arm
- CATEGORIES is a multi-property in the icalendar crate — `property_value()`
  won't find it; must use `multi_properties().get("CATEGORIES")` instead
- `new Date('YYYY-MM-DD')` parses as UTC midnight in JS — use
  `localDateFromString()` from utils.ts for all plain date strings
- Content-Type for CalDAV PUT must be `"text/calendar"` without charset
```

These notes are what prevent future sessions from hitting the same bugs twice.
