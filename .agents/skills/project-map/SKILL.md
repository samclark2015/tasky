---
name: project-map
description: Comprehensive reference of Tasky's project structure, architecture, data models, components, stores, backend, and conventions. Load this at session start to avoid repeated codebase exploration.
---

# Skill: Tasky Project Map

## Purpose

This is a **modular** living reference for the Tasky codebase. The root file (this one) provides the project overview, architecture, and a script to generate a live directory tree. Detailed documentation is split into focused modules that can be loaded individually when needed.

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

Run the following script to see an up-to-date tree of all project files (excludes build artifacts, `node_modules`, `.git`, etc.):

```bash
node .agents/skills/project-map/scripts/tree.js
# or
.agents/skills/project-map/scripts/tree.sh
```

The script lives at `.agents/skills/project-map/scripts/tree.js` (pure Node.js, no external dependencies). It recursively prints the project from the workspace root, directories first, sorted alphabetically.

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
