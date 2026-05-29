# Mindwtr Unreleased

Changes collected after `v0.9.5` and before the next version tag.

## Highlights

- Calendar planning gained macOS Apple Calendar push, optional next-recurring-occurrence previews, safer mobile/macOS push retry behavior, and clearer calendar docs.
- Mobile task lists gained filter controls plus improved prompt, accessibility, and localized-copy behavior.
- Desktop projects and shell behavior received practical UI reliability fixes, including a collapsible project panel, tray/window handling, theme polling, and editor polish.
- Sync, diagnostics, metadata, and release/test gates were tightened for easier maintenance.

## Calendar & Recurrence

- Added one-way macOS Mindwtr -> Apple Calendar push through EventKit.
- Added **Show next occurrence in Calendar** for a planning-only recurrence preview.
- Preserved `showFutureRecurrence` across CloudKit, self-hosted cloud, SQLite, and sync helper paths.
- Avoided duplicate pushed calendar events on transient update/delete failures and kept mappings for retry.
- Clarified dedicated versus shared calendar title behavior.

## Mobile UX

- Added mobile task-list filters.
- Kept project next-action prompts mounted beyond row unmounts and reported failed prompt actions instead of silently closing.
- Improved active filter chip labels, filter modal accessibility, calendar target accessibility states, and context-automation notification localization.
- Rendered task description Markdown snippets and kept inbox inputs above the keyboard.

## Desktop UX

- Added a collapsible project panel.
- Kept desktop tray activation from staying minimized.
- Polled GNOME system theme preference.
- Refined inbox project dropdown behavior and quick-add window presentation.
- Preserved expanded Markdown editor cursor behavior and applied dark theme to Windows chrome.

## Sync, Metadata & Release Reliability

- Suppressed duplicate desktop sync conflict toasts.
- Clarified heartbeat diagnostics copy and improved diagnostics toggle framing.
- Optimized mobile store listing metadata.
- Added root `typecheck` and `native:test` scripts and documented the release verification gates.

## Full Change List (since `v0.9.5`)

- fix(mobile): improve task list accessibility and context copy
- fix(mobile): handle next-action prompt failures
- fix(calendar): avoid duplicate push events
- fix(sync): preserve recurrence preview sync data
- fix(desktop): suppress duplicate sync conflict toasts
- fix(settings): improve diagnostics toggle framing
- fix(i18n): clarify heartbeat diagnostics copy
- chore(metadata): optimize mobile store listings
- fix(mobile): keep project next-action prompt mounted
- fix(desktop): poll gnome system theme preference
- docs: use circular sponsor avatars
- docs: add readme sponsors
- feat(android): add context automation intents
- fix(ci): repair calendar push checks
- feat(calendar): add macos calendar push
- feat(recurrence): add calendar projections
- feat(mobile): add task list filters
- fix(desktop): unminimize tray activation window
- style(ui): polish task list controls
- fix(editors): enable native spellcheck for descriptions
- feat(projects): add collapsible project panel
- fix(flatpak): keep desktop app running in tray
- fix(mobile): render task description markdown snippets
- fix(desktop): keep expanded markdown cursor visible
- fix(checklist): sync markdown checklist state
- fix(desktop): apply dark theme to Windows chrome
- fix(mobile): keep inbox inputs above keyboard
- fix(desktop): refine inbox project dropdown
- fix(desktop): remove quick add window backdrop
- fix(ios): reopen Siri capture on repeated shortcut runs
