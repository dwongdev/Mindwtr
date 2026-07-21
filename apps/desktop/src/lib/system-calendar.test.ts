import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
    createSystemCalendarEventResult,
    fetchSystemCalendarEvents,
    getSystemCalendarPlatform,
    getSystemCalendarPushTargets,
} from './system-calendar';

describe('Linux system calendar adapter', () => {
    beforeEach(() => {
        invoke.mockReset();
        (window as any).__TAURI_INTERNALS__ = {};
        Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Linux x86_64' });
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mindwtr Linux' });
    });

    it('uses Evolution Data Server commands and parses returned ICS events', async () => {
        invoke.mockImplementation(async (command: string) => {
            if (command === 'get_linux_calendar_events') {
                return {
                    permission: 'granted',
                    calendars: [{ id: 'system:work', name: 'Work', url: 'system://work', enabled: true }],
                    icsSources: [{
                        sourceId: 'system:work',
                        ics: [
                            'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nSUMMARY:Planning\r\nDTSTART:20260721T130000Z\r\nDTEND:20260721T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
                        ],
                    }],
                };
            }
            if (command === 'get_linux_writable_calendars') {
                return [{ id: 'work', name: 'Work', isMindwtrDedicated: false }];
            }
            if (command === 'create_linux_calendar_event') {
                return { ok: true, eventId: '["work","event-2"]' };
            }
            throw new Error(`Unexpected command: ${command}`);
        });

        expect(getSystemCalendarPlatform()).toBe('linux');
        const result = await fetchSystemCalendarEvents(
            new Date('2026-07-01T00:00:00.000Z'),
            new Date('2026-08-01T00:00:00.000Z'),
        );
        expect(result.events).toEqual([expect.objectContaining({
            sourceId: 'system:work',
            title: 'Planning',
        })]);

        await getSystemCalendarPushTargets();
        await createSystemCalendarEventResult({
            calendarId: 'work',
            title: 'Planning',
            start: '2026-07-21T13:00:00.000Z',
            end: '2026-07-21T14:00:00.000Z',
            allDay: false,
        });
        expect(invoke).toHaveBeenCalledWith('get_linux_writable_calendars', undefined);
        expect(invoke).toHaveBeenCalledWith('create_linux_calendar_event', expect.any(Object));
    });
});
