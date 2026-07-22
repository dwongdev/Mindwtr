import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '@mindwtr/core';
import { buildWidgetPayload, resolveWidgetLanguage } from './widget-data';

const baseData: AppData = {
    tasks: [],
    projects: [],
    areas: [],
    sections: [],
    settings: {},
};

const pad = (n: number) => String(n).padStart(2, '0');
const toDateOnly = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysFromNow = (n: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
};
const buildDueItem = (dueDate: string, language = 'en') => {
    const now = new Date().toISOString();
    const payload = buildWidgetPayload(
        {
            ...baseData,
            tasks: [
                {
                    id: 'due-task',
                    title: 'Due task',
                    status: 'next',
                    isFocusedToday: true,
                    dueDate,
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
        },
        language as Parameters<typeof buildWidgetPayload>[1],
    );
    return payload.items[0];
};

describe('widget-data', () => {
    it('resolves widget language with fallback', () => {
        expect(resolveWidgetLanguage('zh', undefined)).toBe('zh');
        expect(resolveWidgetLanguage('unknown', undefined)).toBe('en');
        expect(resolveWidgetLanguage(null, 'es')).toBe('es');
    });

    it('builds payload with focus-list tasks and defaults to three items', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            tasks: [
                { id: '1', title: 'Focused 1', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '2', title: 'Focused 2', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '3', title: 'Focused 3', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '4', title: 'Focused 4', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '5', title: 'Next', status: 'next', isFocusedToday: false, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '6', title: 'Inbox', status: 'inbox', isFocusedToday: false, tags: [], contexts: [], createdAt: now, updatedAt: now },
            ],
        };
        const payload = buildWidgetPayload(data, 'en');
        expect(payload.headerTitle).toBeTruthy();
        expect(payload.items).toHaveLength(3);
        expect(payload.items.map((item) => item.title)).toEqual(['Focused 1', 'Focused 2', 'Focused 3']);
        expect(payload.inboxCount).toBe(1);
        expect(payload.subtitle).toBe('Inbox: 1 · +2 More');
    });

    it('honors maxItems option for larger widgets', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            tasks: [
                { id: '1', title: 'Focused 1', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '2', title: 'Focused 2', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '3', title: 'Focused 3', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '4', title: 'Focused 4', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '5', title: 'Focused 5', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
            ],
        };
        const payload = buildWidgetPayload(data, 'en', { maxItems: 5 });
        expect(payload.items).toHaveLength(5);
        expect(payload.items.map((item) => item.title)).toEqual([
            'Focused 1',
            'Focused 2',
            'Focused 3',
            'Focused 4',
            'Focused 5',
        ]);
        expect(payload.subtitle).toBe('Inbox: 0');
    });

    it('puts starred tasks first and counts them in focusedCount regardless of maxItems (#821)', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            tasks: [
                { id: '1', title: 'Next A', status: 'next', isFocusedToday: false, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '2', title: 'Starred next', status: 'next', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '3', title: 'Starred waiting', status: 'waiting', isFocusedToday: true, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '4', title: 'Next B', status: 'next', isFocusedToday: false, tags: [], contexts: [], createdAt: now, updatedAt: now },
            ],
        };
        const payload = buildWidgetPayload(data, 'en', { maxItems: 2 });
        expect(payload.items.map((item) => item.title)).toEqual(['Starred next', 'Starred waiting']);
        expect(payload.focusedCount).toBe(2);
    });

    it('reports zero focusedCount when nothing is starred while still listing next actions (#821)', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            tasks: [
                { id: '1', title: 'Test1', status: 'next', isFocusedToday: false, tags: [], contexts: [], createdAt: now, updatedAt: now },
                { id: '2', title: 'Test 2', status: 'next', isFocusedToday: false, tags: [], contexts: [], createdAt: now, updatedAt: now },
            ],
        };
        const payload = buildWidgetPayload(data, 'en');
        expect(payload.items.map((item) => item.title)).toEqual(['Test1', 'Test 2']);
        expect(payload.focusedCount).toBe(0);
    });

    it('keeps the widget palette aligned with Sepia theme settings', () => {
        const payload = buildWidgetPayload(
            {
                ...baseData,
                settings: { theme: 'sepia' },
            },
            'en'
        );

        expect(payload.palette.background).toBe('#FAF3E3');
        expect(payload.palette.text).toBe('#3B2F2F');
        expect(payload.palette.mutedText).toBe('#7A5C3E');
        expect(payload.palette.accent).toBe('#956735');
    });

    it('includes focus-page schedule/next tasks even when none are explicitly focused', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            tasks: [
                {
                    id: 'next-due',
                    title: 'Next due today',
                    status: 'next',
                    dueDate: '2000-01-01',
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'next-now',
                    title: 'Next action',
                    status: 'next',
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'next-future',
                    title: 'Future next action',
                    status: 'next',
                    startTime: '2999-01-01T00:00:00.000Z',
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
        };
        const payload = buildWidgetPayload(data, 'en');
        expect(payload.items.map((item) => item.id)).toEqual(['next-due', 'next-now']);
    });

    it('keeps deferred project tasks out of widget focus items and inbox count', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            projects: [
                {
                    id: 'active-project',
                    title: 'Active project',
                    status: 'active',
                    color: '#123456',
                    order: 0,
                    tagIds: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'someday-project',
                    title: 'Someday project',
                    status: 'someday',
                    color: '#654321',
                    order: 1,
                    tagIds: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            tasks: [
                {
                    id: 'active-next',
                    title: 'Active next',
                    status: 'next',
                    projectId: 'active-project',
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'deferred-next',
                    title: 'Deferred next',
                    status: 'next',
                    projectId: 'someday-project',
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'deferred-inbox',
                    title: 'Deferred inbox',
                    status: 'inbox',
                    projectId: 'someday-project',
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
        };

        const payload = buildWidgetPayload(data, 'en');

        expect(payload.items.map((item) => item.id)).toEqual(['active-next']);
        expect(payload.inboxCount).toBe(0);
    });

    it('does not let earlier non-widget tasks block a sequential project next task', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            projects: [
                {
                    id: 'project-1',
                    title: 'Sequential project',
                    status: 'active',
                    isSequential: true,
                    color: '#123456',
                    order: 0,
                    tagIds: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            tasks: [
                {
                    id: 'inbox-before',
                    title: 'Inbox before',
                    status: 'inbox',
                    projectId: 'project-1',
                    order: 0,
                    orderNum: 0,
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'available-next',
                    title: 'Available next',
                    status: 'next',
                    projectId: 'project-1',
                    order: 1,
                    orderNum: 1,
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
        };

        const payload = buildWidgetPayload(data, 'en');

        expect(payload.items.map((item) => item.id)).toEqual(['available-next']);
    });

    it('includes the first widget task from each section for section-scoped sequential projects', () => {
        const now = new Date().toISOString();
        const data: AppData = {
            ...baseData,
            projects: [
                {
                    id: 'project-1',
                    title: 'Sequential project',
                    status: 'active',
                    isSequential: true,
                    sequentialScope: 'section',
                    color: '#123456',
                    order: 0,
                    tagIds: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            tasks: [
                {
                    id: 'section-a-first',
                    title: 'Section A first',
                    status: 'next',
                    projectId: 'project-1',
                    sectionId: 'section-a',
                    order: 0,
                    orderNum: 0,
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'section-a-second',
                    title: 'Section A second',
                    status: 'next',
                    projectId: 'project-1',
                    sectionId: 'section-a',
                    order: 1,
                    orderNum: 1,
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    id: 'section-b-first',
                    title: 'Section B first',
                    status: 'next',
                    projectId: 'project-1',
                    sectionId: 'section-b',
                    order: 2,
                    orderNum: 2,
                    tags: [],
                    contexts: [],
                    createdAt: now,
                    updatedAt: now,
                },
            ],
        };

        const payload = buildWidgetPayload(data, 'en');

        expect(payload.items.map((item) => item.id)).toEqual(['section-a-first', 'section-b-first']);
    });

    it('keeps future-start tasks out of the widget payload even when focused', () => {
        const created = new Date().toISOString();
        const future = '2999-01-01T09:00:00.000Z';
        const data: AppData = {
            ...baseData,
            tasks: [
                {
                    id: 'focus-future',
                    title: 'Focused future',
                    status: 'next',
                    isFocusedToday: true,
                    startTime: future,
                    tags: [],
                    contexts: [],
                    createdAt: created,
                    updatedAt: created,
                },
                {
                    id: 'non-focus-future',
                    title: 'Non-focus future',
                    status: 'next',
                    isFocusedToday: false,
                    startTime: future,
                    tags: [],
                    contexts: [],
                    createdAt: created,
                    updatedAt: created,
                },
            ],
        };
        const payload = buildWidgetPayload(data, 'en');
        expect(payload.items).toHaveLength(0);
    });

    it('orders focused tasks using task sort setting before taking top three', () => {
        const data: AppData = {
            ...baseData,
            settings: { taskSortBy: 'created-desc' },
            tasks: [
                {
                    id: 'old',
                    title: 'Old',
                    status: 'next',
                    isFocusedToday: true,
                    tags: [],
                    contexts: [],
                    createdAt: '2026-02-20T10:00:00.000Z',
                    updatedAt: '2026-02-20T10:00:00.000Z',
                },
                {
                    id: 'newest',
                    title: 'Newest',
                    status: 'next',
                    isFocusedToday: true,
                    tags: [],
                    contexts: [],
                    createdAt: '2026-02-22T10:00:00.000Z',
                    updatedAt: '2026-02-22T10:00:00.000Z',
                },
                {
                    id: 'middle',
                    title: 'Middle',
                    status: 'next',
                    isFocusedToday: true,
                    tags: [],
                    contexts: [],
                    createdAt: '2026-02-21T10:00:00.000Z',
                    updatedAt: '2026-02-21T10:00:00.000Z',
                },
                {
                    id: 'older',
                    title: 'Older',
                    status: 'next',
                    isFocusedToday: true,
                    tags: [],
                    contexts: [],
                    createdAt: '2026-02-19T10:00:00.000Z',
                    updatedAt: '2026-02-19T10:00:00.000Z',
                },
            ],
        };
        const payload = buildWidgetPayload(data, 'en');
        expect(payload.items.map((item) => item.id)).toEqual(['newest', 'middle', 'old']);
    });

    describe('due labels', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('labels a task due today with emphasis (date-only string)', () => {
            const item = buildDueItem(toDateOnly(new Date()));
            expect(item.dueLabel).toBe('Today');
            expect(item.dueEmphasis).toBe(true);
        });

        it('labels an overdue task with a compact numeric date and emphasis', () => {
            const item = buildDueItem('2000-01-01');
            expect(item.dueLabel).toBe(
                new Intl.DateTimeFormat('en', { month: 'numeric', day: 'numeric' }).format(
                    new Date(2000, 0, 1),
                ),
            );
            expect(item.dueEmphasis).toBe(true);
        });

        it('labels a task due tomorrow without emphasis', () => {
            const item = buildDueItem(toDateOnly(daysFromNow(1)));
            expect(item.dueLabel).toBe('Tomorrow');
            expect(item.dueEmphasis).toBe(false);
        });

        it('labels a task due within the week with a short weekday', () => {
            const target = daysFromNow(3);
            const item = buildDueItem(toDateOnly(target));
            const expected = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(target);
            expect(item.dueLabel).toBe(expected);
            expect(item.dueLabel).not.toBe('Tomorrow');
            expect(item.dueEmphasis).toBe(false);
        });

        it('labels a far-future task with a compact numeric date, no emphasis', () => {
            const target = daysFromNow(30);
            const item = buildDueItem(toDateOnly(target));
            const expected = new Intl.DateTimeFormat('en', { month: 'numeric', day: 'numeric' }).format(target);
            expect(item.dueLabel).toBe(expected);
            expect(item.dueEmphasis).toBe(false);
        });

        it('returns a null label for a task with no due date', () => {
            const item = buildDueItem('');
            expect(item.dueLabel).toBeNull();
            expect(item.dueEmphasis).toBe(false);
        });

        it('falls back to plain strings when Intl throws', () => {
            vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => {
                throw new Error('no intl');
            }) as unknown as typeof Intl.DateTimeFormat);

            const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const weekTarget = daysFromNow(3);
            const weekItem = buildDueItem(toDateOnly(weekTarget));
            expect(weekItem.dueLabel).toBe(weekday[weekTarget.getDay()]);

            const farTarget = daysFromNow(30);
            const farItem = buildDueItem(toDateOnly(farTarget));
            expect(farItem.dueLabel).toBe(`${farTarget.getMonth() + 1}/${farTarget.getDate()}`);
        });
    });
});
