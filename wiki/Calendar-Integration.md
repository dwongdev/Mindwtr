# Calendar Integration (Hard + Soft Landscape)

Mindwtr supports **view-only external calendars** so you can see hard events alongside your task schedule.

- **Mobile (iOS/Android):** system calendars already exposed by the device, plus ICS subscription URLs
- **Desktop (macOS):** Apple Calendar via EventKit, plus ICS subscription URLs
- **Desktop (Linux/Windows) and Web:** ICS subscription URLs

## Concepts

- **Hard Landscape**: Meetings/classes from external calendars.
- **Soft Landscape**: Mindwtr tasks scheduled with `startTime` and `timeEstimate`.
- The calendar is a **planning surface**, not a capture surface.

## GTD Semantics

- **`dueDate`** = Deadline (hard commitments).
- **`startTime`** = Tickler/scheduled start (soft commitments).
- **`timeEstimate`** = Suggested duration when scheduling.

## Views

- **Day view**: time grid with events + scheduled tasks.
- **Month view**: overview with markers for deadlines, scheduled tasks, and events.

## Scheduling Workflow

1. Pick an **existing** task.
2. Assign a start time (and optionally use the time estimate).
3. Adjust timing later from the task editor or day list.

## External Calendars

### Support Matrix

Supported today:

| Platform | Supported calendar source | Notes |
| --- | --- | --- |
| iOS mobile | Device calendars | Read through the iOS calendar database after permission is granted. This includes accounts enabled in iOS Settings, such as iCloud, Google, Exchange, and Outlook. |
| Android mobile | Device calendars exposed through Android's calendar provider | Google Calendar is the currently verified path. Other sync apps, including DAVx5, work only if they expose calendars through Android's calendar provider in a way Mindwtr can read. |
| Android and iOS mobile | Direct ICS subscription URLs | The URL must return raw iCalendar data. |
| macOS desktop | Apple Calendar accounts | Read through macOS EventKit after permission is granted. This includes calendars synced into Apple Calendar, such as iCloud, Google, and Exchange. |
| Desktop and Web | Direct ICS subscription URLs | The URL must return raw iCalendar data. |

Not supported today:

- Linux native desktop calendar accounts.
- Windows native desktop calendar accounts.
- CalDAV account login, server discovery, or DAVx5-specific account discovery.
- Calendar provider OAuth inside Mindwtr, such as signing in to Google, Microsoft, or Nextcloud from Mindwtr.
- Authenticated/private URLs that return `HTTP 401` unless the secret is already embedded in the URL by the calendar provider.
- Calendar web page URLs, including public share pages that render HTML instead of raw `.ics` data.
- Editing external calendar events from Mindwtr.
- Syncing external calendar events through Mindwtr sync. External events are fetched and cached locally.

### Mobile: System Calendar Integration

On mobile, Mindwtr reads calendars from the device calendar database:

- **Android:** via the Android calendar provider. If a sync app does not expose calendars through that provider, Mindwtr cannot see them.
- **iOS:** via EventKit-backed system calendars, such as iCloud, Google, Exchange, and Outlook once enabled in iOS Settings.

Setup:

1. Open **Settings → Calendar**
2. Enable **System calendar**
3. Grant calendar permission
4. Choose which device calendars to display

Mindwtr stays read-only and does not perform provider OAuth for calendar sources.

### macOS: Apple Calendar Integration

On macOS desktop, Mindwtr can read Apple Calendar events through EventKit:

1. Open **Settings -> Calendar**
2. Request Apple Calendar access
3. Allow Mindwtr in macOS **System Settings -> Privacy & Security -> Calendars**

This works only for calendars that are already visible in Apple Calendar. Linux and Windows do not have native desktop calendar account integration today.

### Desktop/Web: ICS URLs

1. Open **Settings → Calendar**
2. Add your **ICS URL**
3. Refresh to fetch events

Events are cached on-device and are not synced via Mindwtr sync.

### ICS URL Requirements

Mindwtr expects the URL to fetch raw iCalendar text. A working feed usually:

- starts with `BEGIN:VCALENDAR`
- has a URL ending in `.ics` or an explicit subscription/export link from the calendar provider
- can be fetched without an interactive login page or extra headers

Common examples:

- Google Calendar: use the private **Secret address in iCal format**.
- Nextcloud Calendar: use the calendar subscription/export `.ics` link, not the public calendar page URL.

If Mindwtr shows `HTTP 401`, the server is asking for authentication. Username/password prompts, CalDAV login, and bearer-token headers are not supported for calendar URLs. Use the provider's secret iCalendar subscription URL instead.

If a URL opens a normal web page in a browser, it is probably not the ICS feed. Copy the subscription/export URL from that page.

### Private calendars (Google Calendar)

You **do not** need to make your calendar public. Use the private "Secret address" instead:

1. Open Google Calendar on the web → **Settings**.
2. Select the calendar in the left sidebar.
3. In **Integrate calendar**, copy **Secret address in iCal format**.
4. Paste that URL into Mindwtr.

That link acts like a password: only apps with the link can see events, while the calendar stays private.

## Notes

- Calendar does **not** create new tasks.
- External calendars are **read-only** inside Mindwtr.
- Recurring events with `RRULE:...;COUNT=...` stop after their original count. If you previously saw very old recurring events, re-import after updating to v0.4.9+.
