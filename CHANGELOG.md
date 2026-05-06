# Changelog

Canonical release notes live in [docs/release-notes/](docs/release-notes/README.md).

This file intentionally stays as a short index so it does not drift from the per-release notes.

## Latest Releases

- [v0.9.0](docs/release-notes/0.9.0.md)
- [v0.8.9](docs/release-notes/0.8.9.md)
- [v0.8.8](docs/release-notes/0.8.8.md)
- [v0.8.7](docs/release-notes/0.8.7.md)
- [v0.8.6](docs/release-notes/0.8.6.md)
- [v0.8.5](docs/release-notes/0.8.5.md)
- [v0.8.4](docs/release-notes/0.8.4.md)
- [v0.8.3](docs/release-notes/0.8.3.md)
- [v0.8.2](docs/release-notes/0.8.2.md)
- [Full release notes index](docs/release-notes/README.md)

## Unreleased (v0.9.1)

These changes are intended for the next patch release after `v0.9.0`.

### Fixed

- Hardened sync conflict handling for tombstones whose `updatedAt` is newer than `deletedAt`.
- Serialized concurrent sync cycles so manual and scheduled sync cannot interleave their read/merge/write windows.
- Capped sync revision increments at the safe 32-bit ceiling.
- Blocked public cleartext HTTP sync endpoints while still allowing local/private HTTP targets.
- Hardened Mindwtr Cloud attachment path creation against symlink traversal races.
- Added visible cleartext-sync and sync-state warnings in the desktop sidebar.
- Added Undo for project deletion on desktop and mobile.
- Localized the mobile sync activity indicator copy.

### Performance

- Patched hot task-store mutations by ID instead of rebuilding full task arrays for single-task updates.
- Added validated stable sync signature caching for cloned entity revisions.
- Split desktop ListView store selectors so data, settings, and actions subscribe independently.

### Tests

- Added a browser-level Playwright color-contrast pass for the desktop app.
