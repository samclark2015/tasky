# Phase 7 – Mobile Responsive UI

**Duration:** ~1 week  
**Goal:** Make Tasky fully functional and polished on Android (and small screens in general) without breaking the existing desktop experience.

---

## Objectives

1. Detect mobile vs desktop at runtime and switch layout accordingly — no code forks, single codebase.
2. Replace the sidebar with a touch-friendly bottom navigation bar.
3. Replace the right-column details panel with a drag-to-dismiss bottom sheet.
4. Add a FAB for new-task creation on mobile.
5. Add animated page transitions and a "More" sheet for Lists/Settings access.
6. Adapt views and components for touch (larger targets, long-press context, calendar simplification).

---

## Dependencies

- Phase 6 (Provider Abstraction) must be complete ✅

---

## Tasks

### 7.1 Foundation

- [ ] Install `framer-motion` (`pnpm add framer-motion`)
- [ ] Create `src/hooks/use-is-mobile.ts`
  - `useState<boolean>` initialized from `window.innerWidth < 768`
  - Debounced resize listener (16ms) updates state on window resize
  - Returns `isMobile: boolean`
- [ ] Add `moreSheetOpen: boolean` + `setMoreSheetOpen(open: boolean)` to `src/stores/ui.ts`
  - Not persisted (runtime-only UI state)
- [ ] Update `index.html`: add `viewport-fit=cover` to the `<meta name="viewport">` tag
- [ ] Update `src/index.css`:
  - Add `env(safe-area-inset-*)` CSS custom properties
  - Add `touch-action: manipulation` to `button, a, [role="button"]` base rule
  - Add `overscroll-behavior: none` is already present; also add `overscroll-behavior: contain` utility class for sheet scroll containers

**Acceptance criteria:** `useIsMobile()` returns `true` when viewport < 768px, `false` otherwise; updates live on resize.

---

### 7.2 Responsive AppShell

- [ ] `src/components/layout/app-shell.tsx`
  - Import `useIsMobile`
  - On mobile: render no sidebar aside column, render no right details-panel column
  - On mobile: add `pb-16` (bottom nav clearance) + `pb-[env(safe-area-inset-bottom)]` to `<main>`
  - On mobile: remove `data-tauri-drag-region` div (h-8 title bar area) — wastes space and is non-functional on Android
  - Desktop: completely unchanged
- [ ] `src/components/layout/sidebar.tsx`
  - Add `hidden md:flex` so it is invisible on mobile (bottom nav replaces it)

**Acceptance criteria:** On mobile viewport, sidebar is gone, main fills full width with bottom padding.

---

### 7.3 Bottom Navigation Bar

New file: `src/components/layout/bottom-nav.tsx`

- [ ] 5 tabs: **Today**, **Inbox**, **Calendar**, **Planner**, **More (···)**
- [ ] Each tab: icon + label, min touch target 48×48px
- [ ] Active tab highlighted; animated indicator using `motion.span` with `layoutId="nav-indicator"` (Framer Motion shared layout animation)
- [ ] Fixed to bottom of viewport, full width, `min-h-[56px]`
- [ ] Bottom padding: `pb-[env(safe-area-inset-bottom)]` for Android system navigation bar clearance
- [ ] `z-40` so it sits above view content
- [ ] Tapping a nav item calls `useUIStore.navigateTo(view)` and closes `detailsPanelOpen`
- [ ] More tab calls `setMoreSheetOpen(true)` instead of navigating
- [ ] Rendered in `App.tsx` (or `AppShell`) only when `isMobile === true`

**Acceptance criteria:** Tapping tabs navigates correctly; animated indicator slides to active tab; More opens the sheet.

---

### 7.4 "More" Bottom Sheet

New file: `src/components/layout/more-sheet.tsx`

- [ ] Controlled by `moreSheetOpen` from `useUIStore`
- [ ] Rendered via `createPortal` to `document.body`
- [ ] Framer Motion `AnimatePresence` + `motion.div` with `initial={{ y: "100%" }}` → `animate={{ y: 0 }}` → `exit={{ y: "100%" }}` (spring or tween)
- [ ] Faded backdrop (`motion.div` opacity 0→0.4→0) behind sheet; tap backdrop to dismiss
- [ ] Drag handle at top of sheet (decorative pill)
- [ ] Content sections:
  - **My Lists**: maps `useListStore.lists`, each row shows colored dot + list name; tap → `navigateTo('list', listId)` + `setMoreSheetOpen(false)`
  - **New List** button → opens existing `ListModal` (keep using it)
  - **Settings** row → `navigateTo('settings')` + `setMoreSheetOpen(false)`
- [ ] Drag-to-dismiss: `drag="y"`, `dragConstraints={{ top: 0 }}`, close when `offset.y > 100` on `onDragEnd`

**Acceptance criteria:** Sheet slides up smoothly; lists are tappable and navigate; swipe down or tap backdrop dismisses.

---

### 7.5 Details Panel as Mobile Bottom Sheet

New file: `src/components/layout/bottom-sheet.tsx` (reusable wrapper)

- [ ] Props: `open: boolean`, `onClose: () => void`, `children: ReactNode`
- [ ] Rendered via `createPortal` to `document.body`
- [ ] `AnimatePresence` so it unmounts when closed
- [ ] `motion.div` sheet:
  - `initial={{ y: "100%" }}` → `animate={{ y: 0 }}` → `exit={{ y: "100%" }}`
  - `drag="y"`, `dragConstraints={{ top: 0 }}`, `dragElastic={{ top: 0, bottom: 0.3 }}`
  - Close when `onDragEnd` sees `info.offset.y > 100`
  - Full width, `h-[90vh]`, rounded top corners (`rounded-t-2xl`)
  - Drag handle pill at top
  - `overflow-y-auto` with `overscroll-behavior: contain` inside
- [ ] Faded backdrop (tap to close)
- [ ] `z-50`

Update `src/components/layout/app-shell.tsx`:

- [ ] On mobile + `detailsPanelOpen === true`: render `<BottomSheet open onClose={() => selectTask(null)}><DetailsPanel /></BottomSheet>`
- [ ] Desktop: unchanged right-column `<aside className="w-80">`

**Acceptance criteria:** Selecting a task on mobile slides up the details sheet; swipe down or tap backdrop dismisses it; desktop layout unchanged.

---

### 7.6 FAB (Floating Action Button)

New file: `src/components/ui/fab.tsx`

- [ ] Circular button, `w-14 h-14`, primary background color (`bg-primary text-primary-foreground`)
- [ ] Plus icon (Lucide `Plus`)
- [ ] Fixed position: `bottom-20 right-4` (above bottom nav), `z-40`
- [ ] Framer Motion: `whileTap={{ scale: 0.9 }}` with spring, `whileHover={{ scale: 1.05 }}`
- [ ] Shadow: `shadow-lg`
- [ ] On press: triggers `setShowNewTask(true)` (same as `n` keyboard shortcut on desktop)

Update `src/App.tsx`:

- [ ] Render `<FAB />` only when `isMobile === true`
- [ ] FAB sits outside `AppShell` so it layers over everything correctly

**Acceptance criteria:** FAB is visible on mobile, opens new task modal on tap, animates on press.

---

### 7.7 Animated Page Transitions

Update `src/App.tsx` (`ViewRouter`):

- [ ] Wrap `ViewRouter` output in Framer Motion `AnimatePresence mode="wait"`
- [ ] Define nav order map:
  ```ts
  const VIEW_ORDER: Record<ViewType, number> = {
    today: 0, inbox: 1, calendar: 2, planner: 3,
    list: 3, search: 4, settings: 5,
  }
  ```
- [ ] Track `previousView` in a `useRef`; compute direction (`1` = forward, `-1` = backward) on render
- [ ] Each rendered view wrapped in `motion.div` with `key={currentView}`:
  - `initial={{ x: direction * 40, opacity: 0 }}`
  - `animate={{ x: 0, opacity: 1 }}`
  - `exit={{ x: direction * -40, opacity: 0 }}`
  - Transition: `{ duration: 0.2, ease: 'easeInOut' }`
- [ ] Only apply on mobile (`isMobile`); desktop uses no transition wrapper

**Acceptance criteria:** Navigating forward slides new view in from right; backward from left. No flash/jank.

---

### 7.8 View & Component Adaptations

#### Calendar view (`src/views/calendar/index.tsx`)

- [ ] Import `useIsMobile`
- [ ] On mobile: `initialView="dayGridMonth"`
- [ ] On mobile: simplified `headerToolbar: { left: 'prev,next', center: 'title', right: '' }` (no view switcher — month only)
- [ ] Desktop: unchanged (existing config)

#### TaskItem (`src/components/task/task-item.tsx`)

- [ ] On mobile: add `py-3` for taller touch targets (≥48px row height)
- [ ] Create `src/hooks/use-long-press.ts`:
  - Options: `{ onLongPress, delay? = 500 }`
  - Attaches `touchstart`, `touchend`, `touchmove` listeners
  - Fires `onLongPress` after `delay` ms if touch did not move >10px
  - Returns `{ onTouchStart, onTouchEnd, onTouchMove }` event handlers
- [ ] On mobile: replace right-click context menu with long-press → bottom action sheet
  - Action sheet options: Set Priority, Edit Tags, Move to List, Delete
  - Implemented as a simple `motion.div` sheet (reuse `BottomSheet` wrapper)
- [ ] Desktop: right-click `TaskContextMenu` unchanged

#### All views

- [ ] Add `pb-4` (or `pb-safe`) bottom padding inside each view's scroll container so last item is not hidden behind the bottom nav

**Acceptance criteria:** Touch targets are comfortable; long-press shows actions; calendar shows month grid on mobile.

---

### 7.9 Polish & Safe Areas

- [ ] `src/App.tsx`: gate all keyboard shortcut handlers with `if (isMobile) return` at the top of the `keydown` handler
- [ ] Z-index audit (document in `conventions.md`):
  - View content: default
  - FAB: `z-40`
  - Bottom nav: `z-40`
  - Sheet backdrops: `z-50`
  - Sheet panels: `z-50`
  - Modals (existing): `z-50` (no change)
- [ ] Verify `overscroll-behavior: contain` on all sheet scroll containers (prevents page pull-to-refresh interfering)
- [ ] Verify `touch-action: manipulation` on all interactive elements (eliminates 300ms tap delay)
- [ ] Test dark mode on mobile (theme already driven by CSS class — should work automatically)

**Acceptance criteria:** No z-index collisions; no accidental pull-to-refresh; keyboard shortcuts don't fire on mobile.

---

### 7.10 Project Map Update

- [ ] Update `.agents/skills/project-map/frontend.md`:
  - Add new hooks: `use-is-mobile.ts`, `use-long-press.ts`
  - Add new layout components: `bottom-nav.tsx`, `more-sheet.tsx`, `bottom-sheet.tsx`
  - Add new UI component: `fab.tsx`
  - Document mobile vs desktop layout branching pattern
- [ ] Update `.agents/skills/project-map/SKILL.md`:
  - Note Android as supported platform
  - Note `framer-motion` in tech stack / dependencies

---

## Deliverables

- `framer-motion` installed and working
- `useIsMobile()` hook driving all layout branches
- Bottom nav replacing sidebar on mobile
- Details panel renders as swipeable bottom sheet on mobile
- "More" sheet exposing lists and settings on mobile
- FAB for new task creation on mobile
- Animated page transitions on mobile
- Calendar restricted to month view on mobile
- Long-press task context actions on mobile
- Desktop layout and behavior completely unchanged
- Project map updated

---

## Technical Notes

### Framer Motion patterns used

| Pattern | Usage |
|---|---|
| `AnimatePresence` | Sheet mount/unmount, page transitions |
| `motion.div` with `drag="y"` | Draggable bottom sheets |
| `layoutId` shared layout | Bottom nav active indicator |
| `whileTap` / `whileHover` | FAB micro-interaction |
| `mode="wait"` | Page transitions (prevents old + new view overlapping) |

### Safe area insets (Android)

Android adds system navigation bar at the bottom. Use:
```css
padding-bottom: env(safe-area-inset-bottom);
```
This requires `viewport-fit=cover` in the viewport meta tag. Without it, `env()` values are 0.

### `drag="y"` gotcha

Framer Motion's `drag` prop intercepts pointer events. If a sheet contains a scroll container, add `dragListener={false}` on inner scrollable divs, or use `dragConstraints` carefully so the drag only activates on the handle.

### FullCalendar on mobile

FullCalendar v6 is not designed for mobile. The month grid (`dayGridMonth`) is the only view that renders acceptably on small screens. Time grid views (`timeGridWeek`, `timeGridDay`) overflow and are not usable. Restrict to month-only on mobile.

### Bottom nav vs sidebar state

`useUIStore.currentView` drives both the sidebar active item (desktop) and the bottom nav active tab (mobile). No new state needed — the bottom nav just reads the same store.

### Keyboard shortcuts on mobile

The existing keyboard handler in `App.tsx` should early-return when `isMobile === true`. Physical keyboards attached to Android devices are edge-case enough to skip for MVP.

### Z-index layering

```
view content        (default, no z-index)
FAB                 z-40
bottom nav          z-40
bottom sheet        z-50  (must be above bottom nav)
more sheet          z-50
backdrop            z-50  (same level; order in DOM determines stacking)
existing modals     z-50  (no change)
```
