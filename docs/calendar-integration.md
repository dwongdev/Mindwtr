# Calendar Integration (Hard + Soft Landscape)

## Goals

- **View-only** external calendars (Google / Outlook) inside Mindwtr.
- Make planning feel natural by showing:
  - **Hard Landscape**: meetings/classes (external calendar events)
  - **Soft Landscape**: tasks (Mindwtr) with `timeEstimate`
- Provide a “bridge” workflow:
  - See busy blocks (gray)
  - Place **existing** tasks into free time (no task creation from calendar)

---

## GTD Semantics (Mindwtr Fields)

### `dueDate` = Deadline (Hard)

- Use `dueDate` only for true deadlines (e.g., “Submit assignment”).
- Calendar shows deadlines clearly (all-day badge or timed marker if time is present).

### `startTime` = Tickler / Scheduled Start (Soft)

- Use `startTime` for “not before” availability and time-blocking.
- Recommended behavior:
  - Tasks with `startTime` **in the future** are hidden from action lists (“Next”, “Inbox”), but visible in a “Future”/Tickler view.
  - Once `startTime <= now`, the task becomes actionable again and appears in its status list.

### `timeEstimate` = Duration Hint (Soft)

- Used for planning blocks on the calendar/agenda (default duration).
- Users can still override duration during scheduling if needed.

---

## UI Targets

### Calendar Views

- **Day view**: time grid with events + scheduled tasks.
- **3‑day view**: same grid, multiple columns.
- **Month view**: high-level overview with markers for:
  - deadlines (`dueDate`)
  - scheduled tasks (`startTime`)
  - external events (summary/indicators)

### Scheduling UX

- Calendar is **not** a capture surface.
- Scheduling means **placing an existing task** onto the calendar by setting:
  - `startTime` (and optionally inferred duration from `timeEstimate`)

**Desktop**
- Drag tasks from a “Next Actions” tray into empty slots.
- Drag to move; resize to adjust duration (optional later).

**Mobile**
- Long‑press task → “Schedule…” → pick time (or quick presets).
- Optional drag scheduling later (gesture complexity).

---

## Integrations

### MVP: iCal / ICS Subscription (Recommended First Step)

- Allow users to paste a calendar **ICS URL** (view-only).
- Fetch and parse events into an in-app cache.
- Works with Google/Outlook calendar publishing links without implementing OAuth first.

### Full: Provider OAuth (Later)

- Google Calendar: OAuth + read-only scope.
- Outlook/Microsoft 365: Microsoft Graph + read-only calendar scope.
- Store tokens securely per platform (avoid putting tokens in synced `data.json`):
  - Mobile: Secure storage
  - Desktop: OS keychain/secure store (fallback to config with warnings)
  - Web: avoid `localStorage` tokens; prefer server-backed sessions

---

## Data & Caching

- External calendar events are **derived data**:
  - Store in per-device cache with `lastFetchedAt`
  - Refresh manually and on a cadence (e.g., every 15–60 minutes)
- Do **not** sync external calendar event blobs via Mindwtr sync.

---

## Phased Implementation

### Phase A — Planner Foundations

- Add Day / 3‑day calendar views.
- Render Mindwtr tasks as blocks using `startTime + timeEstimate`.
- Enforce “calendar doesn’t create tasks” (schedule existing only).

### Phase B — ICS Import

- Settings: add “External Calendar (ICS URL)” + refresh + toggles.
- Parse + cache events; show as background blocks.

### Phase C — Provider Connectors

- Google + Outlook sign-in flows.
- Calendar selection (which calendars to show).
- Token storage hardening.

### Phase D — Drag Scheduling Polish

- Desktop drag/drop from Next Actions into timeline.
- Conflict highlighting and “free slot” snapping.

