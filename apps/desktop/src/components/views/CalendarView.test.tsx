import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '../../contexts/language-context';
import { CalendarView } from './CalendarView';

vi.mock('@mindwtr/core', async () => {
    const actual = await vi.importActual<typeof import('@mindwtr/core')>('@mindwtr/core');
    const taskStoreState = {
        areas: [],
        deleteTask: vi.fn(async () => {}),
        getDerivedState: () => ({
            projectMap: new Map(),
        }),
        settings: {
            diagnostics: {
                loggingEnabled: false,
            },
            weekStart: 'sunday',
        },
        tasks: [],
        updateTask: vi.fn(async () => {}),
    };
    const useTaskStore = Object.assign(
        (selector: (state: typeof taskStoreState) => unknown) => selector(taskStoreState),
        {
            getState: () => taskStoreState,
            subscribe: vi.fn(),
        }
    );

    return {
        ...actual,
        isTaskInActiveProject: () => true,
        safeFormatDate: (value: Date) => value.toISOString(),
        safeParseDate: (value: string) => new Date(value),
        safeParseDueDate: (value: string) => new Date(value),
        shallow: () => false,
        useTaskStore,
    };
});

vi.mock('../../lib/external-calendar-events', () => ({
    fetchExternalCalendarEvents: vi.fn(async () => ({ calendars: [], events: [] })),
}));

describe('CalendarView', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-03T14:48:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the today marker with explicit primary contrast tokens', async () => {
        render(
            <LanguageProvider>
                <CalendarView />
            </LanguageProvider>
        );

        await act(async () => {
            await Promise.resolve();
        });

        const todayNumber = screen.getByText('3');
        const markerStyle = todayNumber.parentElement?.getAttribute('style') ?? '';
        expect(markerStyle).toContain('background-color: hsl(var(--primary));');
        expect(markerStyle).toContain('color: hsl(var(--primary-foreground));');
    });
});
