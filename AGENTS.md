# Tasky - Agent Instructions

## Session Startup

1. **Load the `project-map` skill first.** It contains a comprehensive reference of the project structure, architecture, data models, stores, components, backend, and conventions. This eliminates the need to explore the codebase from scratch every session.

2. **Load the `planning` skill** if you need to check or update project progress, plans, or phase status.

3. Read `PROGRESS.md` (via the planning skill) for current status if you're continuing development work.

## Skills

| Skill | Purpose | When to load |
|---|---|---|
| `project-map` | Living reference of project structure, architecture, and conventions | **Every session** -- load at start |
| `planning` | Phased project planning and progress tracking | When working on planned features or checking status |
| `docs` | User-facing documentation structure and maintenance protocol | When writing, reviewing, or updating docs after feature changes |

## Development Workflow

### Commands

| Command | Use |
|---|---|
| `pnpm dev` | Full app (Vite + Tauri/Rust) |
| `pnpm typecheck` | Type-check frontend |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint frontend |
| `pnpm build` | Production build |

### Before committing

Run `pnpm typecheck` to catch type errors. Run `pnpm lint` if you've added new files.

### Key paths

- Types: `src/types/types.ts`
- Stores: `src/stores/`
- DB schema: `src/db/migrations/index.ts`
- Views: `src/views/`
- Components: `src/components/`
- Rust providers: `providers/src/`
- Tauri IPC: `src-tauri/src/providers.rs`

## Keeping Skills Updated

When you add new files, modules, views, stores, or change architectural patterns, **update the `project-map` skill** (`/.agents/skills/project-map/SKILL.md`) so future sessions stay accurate. This is critical for maintaining agent efficiency across sessions.
