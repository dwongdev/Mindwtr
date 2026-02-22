import { describe, expect, it } from 'vitest';
import type { AppData } from '@mindwtr/core';
import { buildWidgetPayload, resolveWidgetLanguage } from './widget-data';

const baseData: AppData = {
    tasks: [],
    projects: [],
    areas: [],
    sections: [],
    settings: {},
};

describe('widget-data', () => {
    it('resolves widget language with fallback', () => {
        expect(resolveWidgetLanguage('zh', undefined)).toBe('zh');
        expect(resolveWidgetLanguage('unknown', undefined)).toBe('en');
        expect(resolveWidgetLanguage(null, 'es')).toBe('es');
    });

    it('builds payload with focused tasks only and caps to three', () => {
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
    });

    it('keeps focused tasks even when start time is in the future', () => {
        const now = new Date('2026-02-22T12:00:00.000Z');
        const future = new Date('2026-02-23T09:00:00.000Z').toISOString();
        const created = now.toISOString();
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
        expect(payload.items.map((item) => item.id)).toEqual(['focus-future']);
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
});
