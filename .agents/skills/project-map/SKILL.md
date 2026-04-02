---
name: project-map
description: Comprehensive reference of Tasky's project structure, architecture, data models, components, stores, backend, and conventions. Load this at session start to avoid repeated codebase exploration.
---

# Skill: Tasky Project Map

## Purpose

This is a **modular** living reference for the Tasky codebase. The root file (this one) provides the project overview, directory tree, and architecture. Detailed documentation is split into focused modules that can be loaded individually when needed.

**Keep these files updated** when you add new files, modules, views, stores, or change architectural patterns.

## Module Index

| Module | File | Load when... |
|---|---|---|
| **Overview & Architecture** | `SKILL.md` (this file) | Every session -- always loaded with the skill |
| **Data Model** | `data-model.md` | Working with types, SQL schema, or migrations |
| **Stores** | `stores.md` | Working with state management or store actions |
| **Database** | `database.md` | Working with DB adapter, repositories, or migrations |
| **Frontend** | `frontend.md` | Working with components, views, or UI |
| **Backend** | `backend.md` | Working with Rust, Tauri IPC, or sync providers |
| **Conventions** | `conventions.md` | Need naming rules, patterns, gotchas, or styling info |

---

## 1. Project Overview

| Field | Value |
|---|---|
| Name | Tasky (`com.tasky.app`) |
| Version | 0.0.1 |
| Purpose | Native desktop task management with CalDAV and GitHub sync |
| Frontend | TypeScript, React 18, Zustand, Tailwind CSS, Vite |
| Backend | Rust (Tauri 2.0 shell), SQLite via `tauri-plugin-sql` |
| Package manager | pnpm |
| Rust workspace | Root `Cargo.toml` with members `src-tauri` and `providers` |

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Full Tauri dev (Vite + Rust) |
| `pnpm build` | Production build |
| `pnpm dev:frontend` | Vite dev server only (port 1420) |
| `pnpm build:frontend` | `tsc -b && vite build` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | `vitest run` |
| `pnpm lint` | `eslint src --ext .ts,.tsx` |

---

## 2. Directory Tree

```
tasky2/
├── AGENTS.md                    # Agent instructions
├── Cargo.toml                   # Rust workspace root (members: src-tauri, providers)
├── package.json                 # Frontend manifest (pnpm)
├── tsconfig.json                # Strict TS, path alias @/* -> ./src/*
├── vite.config.ts               # React plugin, @/ alias, port 1420, Tauri HMR
├── tailwind.config.js           # Dark mode via class, shadcn/ui HSL tokens
├── postcss.config.js            # Tailwind + Autoprefixer
├── index.html                   # Vite SPA entry, mounts at #root
│
├── src/                         # FRONTEND SOURCE
│   ├── main.tsx                 # Entry: StrictMode > ThemeProvider > AppProvider > App
│   ├── App.tsx                  # Root component: ViewRouter, keyboard shortcuts, theme sync
│   ├── index.css                # Tailwind directives + HSL design tokens (light/dark)
│   ├── components/
│   │   ├── app-provider.tsx     # DB init, migration, store hydration, AutoSyncMount
│   │   ├── theme-provider.tsx   # Theme context wrapping Zustand UI store
│   │   ├── layout/
│   │   │   ├── index.ts         # Barrel: AppShell, Sidebar, DetailsPanel
│   │   │   ├── app-shell.tsx    # 3-column layout: sidebar | main | details
│   │   │   ├── sidebar.tsx      # Nav items, list list, sync button, settings
│   │   │   ├── details-panel.tsx# Task detail editing (inline fields, subtasks)
│   │   │   └── view-header.tsx  # Reusable header with title + actions slot
│   │   ├── modals/
│   │   │   ├── task-modal.tsx   # Create/edit task (Radix Dialog)
│   │   │   └── list-modal.tsx   # Create/edit/delete list (Radix Dialog)
│   │   └── task/
│   │       ├── task-item.tsx    # Recursive task row (subtasks, context menu)
│   │       ├── task-context-menu.tsx  # Custom right-click menu (portal)
│   │       ├── quick-add.tsx    # Inline title-only task creation input
│   │       ├── tag-input.tsx    # Tag pills with autocomplete
│   │       └── recurrence-editor.tsx  # Recurrence rule form
│   ├── views/
│   │   ├── inbox/index.tsx      # Unassigned tasks (no listId)
│   │   ├── today/index.tsx      # Due today + overdue tasks
│   │   ├── list/index.tsx       # Tasks for a specific list
│   │   ├── calendar/
│   │   │   ├── index.tsx        # FullCalendar with tasks + events
│   │   │   └── event-detail-popover.tsx  # VEVENT detail popover
│   │   ├── planner/index.tsx    # 14-day rolling planner with time estimates
│   │   ├── search/index.tsx     # Full-text search across tasks
│   │   └── settings/index.tsx   # Account management, sync config (1042 lines)
│   ├── stores/
│   │   ├── index.ts             # Barrel re-export of all stores
│   │   ├── tasks.ts             # Task CRUD, Map<id, Task>, subscribeWithSelector
│   │   ├── lists.ts             # List CRUD, TaskList[]
│   │   ├── ui.ts                # UI state, persisted to localStorage
│   │   ├── sync.ts              # CalDAV + GitHub sync orchestration (689 lines)
│   │   └── events.ts            # Calendar events (VEVENT), not persisted to DB
│   ├── db/
│   │   ├── index.ts             # Barrel
│   │   ├── repository.ts        # DatabaseAdapter interface + 6 repository factories
│   │   ├── migrate.ts           # Sequential migration runner
│   │   └── migrations/
│   │       └── index.ts         # 9 SQL migrations defining full schema
│   ├── hooks/
│   │   └── use-auto-sync.ts     # Periodic + debounced pending-task sync
│   ├── lib/
│   │   ├── database.ts          # Tauri SQLite singleton + adapter factory
│   │   └── utils.ts             # cn, generateId, date helpers
│   ├── providers/
│   │   ├── ipc.ts               # Tauri invoke() wrappers (snake/camel conversion)
│   │   └── types.ts             # Wire types mirroring Rust structs
│   └── types/
│       ├── types.ts             # All domain types (Task, TaskList, accounts, etc.)
│       └── index.ts             # Barrel
│
├── src-tauri/                   # TAURI BACKEND (Rust)
│   ├── Cargo.toml               # Crate: tasky / tasky_lib
│   ├── tauri.conf.json          # App config: window 1200x750, SQLite preload
│   ├── build.rs                 # Tauri build script
│   ├── capabilities/
│   │   └── default.json         # Permissions: core, window, sql, notification
│   ├── src/
│   │   ├── main.rs              # Binary entry: calls tasky_lib::run()
│   │   ├── lib.rs               # App setup: plugins, IPC commands, theme menu
│   │   └── providers.rs         # Thin IPC wrappers delegating to tasky-providers
│   ├── icons/                   # App icons (png, icns, ico)
│   └── gen/                     # Tauri generated code
│
├── providers/                   # SYNC PROVIDERS (Rust library crate)
│   ├── Cargo.toml               # Crate: tasky-providers
│   └── src/
│       ├── lib.rs               # SyncProvider trait, shared types, dispatch module
│       ├── caldav/
│       │   ├── mod.rs           # CalDavProvider: test, discover, sync, fetch_events
│       │   └── ical.rs          # VTodo/VEvent iCal parsing and serialization
│       └── github/
│           └── mod.rs           # GitHubProvider: issues as tasks, repos as calendars
│
├── .agents/skills/              # Agent skills
│   ├── planning/                # Project planning skill
│   └── project-map/             # THIS SKILL - project structure reference
│       ├── SKILL.md             # Overview, directory tree, architecture (this file)
│       ├── data-model.md        # Types, SQL schema
│       ├── stores.md            # Zustand stores, state shapes, actions
│       ├── database.md          # Adapter, repositories, migrations
│       ├── frontend.md          # Components, views, hooks
│       ├── backend.md           # Tauri, IPC, Rust providers
│       └── conventions.md       # Patterns, naming, gotchas, styling
├── .vscode/                     # VS Code launch/tasks config
├── .opencode/                   # OpenCode config
└── .crush/                      # Crush config
```

---

## 3. Architecture

### Navigation

There is **no URL-based router**. Navigation is state-driven via `useUIStore.currentView` (type `ViewType`). `App.tsx` contains a `ViewRouter` function that switches on the view type string to render the appropriate view component.

```
ViewType = 'today' | 'inbox' | 'calendar' | 'planner' | 'list' | 'search' | 'settings'
```

For `'list'` view, `useUIStore.currentListId` determines which list to show.

### Provider Stack (top to bottom)

```
main.tsx: React.StrictMode > ThemeProvider > AppProvider > App
```

- `ThemeProvider` -- reads theme from Zustand, applies `dark` CSS class, provides `useTheme()` context
- `AppProvider` -- initializes SQLite, runs migrations, hydrates stores, provides `useApp()` context with `{ adapter, ready, error }`, mounts `AutoSyncMount` (renderless component running `useAutoSync` hook)

### Layout

`AppShell` renders a 3-column flexbox layout:
1. **Sidebar** (`w-60` expanded / `w-14` collapsed) -- nav items, lists, sync/settings buttons
2. **Main content** -- drag region (custom title bar) + view content
3. **Details panel** (`w-80`, conditional) -- task detail editing

### Keyboard Shortcuts (App.tsx)

| Key | Action |
|---|---|
| `Cmd/Ctrl+F` | Navigate to search |
| `n` | Open new task modal |
| `Escape` | Deselect task / close details |
| `1` | Navigate to Today |
| `2` | Navigate to Inbox |
| `3` | Navigate to Calendar |
| `4` | Navigate to Planner |

Shortcuts skip `<input>`, `<textarea>`, and `<select>` elements.

---

## 4. Key File Reference (quick lookup)

| What you need | Where to find it |
|---|---|
| All TypeScript types | `src/types/types.ts` |
| SQL schema | `src/db/migrations/index.ts` |
| Store state shapes | `src/stores/*.ts` |
| Utility functions | `src/lib/utils.ts` |
| Database adapter | `src/lib/database.ts` |
| Repository SQL | `src/db/repository.ts` |
| IPC to Rust | `src/providers/ipc.ts` |
| Wire types | `src/providers/types.ts` |
| Tauri commands | `src-tauri/src/providers.rs` |
| Provider trait | `providers/src/lib.rs` |
| CalDAV sync logic | `providers/src/caldav/mod.rs` |
| iCal parsing | `providers/src/caldav/ical.rs` |
| GitHub sync logic | `providers/src/github/mod.rs` |
| Design tokens | `src/index.css` |
| App config | `src-tauri/tauri.conf.json` |
| Keyboard shortcuts | `src/App.tsx` |
| Auto-sync logic | `src/hooks/use-auto-sync.ts` |
