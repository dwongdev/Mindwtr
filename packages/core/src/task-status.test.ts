import { describe, expect, it } from 'vitest';
import { normalizeTaskForLoad } from './task-status';
import type { Task } from './types';

const NOW_ISO = '2026-07-16T12:00:00.000Z';

const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 't1',
    title: 'Task',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
    revBy: 'device-a',
    ...overrides,
});

describe('normalizeTaskForLoad focusOrder invariant', () => {
    it('clears focusOrder when a loaded task is done', () => {
        const task = createTask({
            status: 'done',
            isFocusedToday: true,
            focusOrder: 2,
        });

        const normalized = normalizeTaskForLoad(task, NOW_ISO);

        expect(normalized.isFocusedToday).toBe(false);
        expect(normalized.focusOrder).toBeUndefined();
    });

    it('clears focusOrder when a loaded task is archived', () => {
        const task = createTask({
            status: 'archived',
            isFocusedToday: true,
            focusOrder: 1,
        });

        const normalized = normalizeTaskForLoad(task, NOW_ISO);

        expect(normalized.isFocusedToday).toBe(false);
        expect(normalized.focusOrder).toBeUndefined();
    });

    it('clears focusOrder when a focused task defers to a future start', () => {
        const task = createTask({
            status: 'next',
            isFocusedToday: true,
            focusOrder: 4,
            startTime: '2099-01-01',
        });

        const normalized = normalizeTaskForLoad(task, NOW_ISO);

        expect(normalized.isFocusedToday).toBe(false);
        expect(normalized.focusOrder).toBeUndefined();
    });

    it('does not touch focusOrder for a live, non-deferred focused task', () => {
        const task = createTask({
            status: 'next',
            isFocusedToday: true,
            focusOrder: 0,
        });

        const normalized = normalizeTaskForLoad(task, NOW_ISO);

        expect(normalized.isFocusedToday).toBe(true);
        expect(normalized.focusOrder).toBe(0);
    });

    it('is idempotent for done tasks', () => {
        const task = createTask({
            status: 'done',
            isFocusedToday: true,
            focusOrder: 2,
        });

        const once = normalizeTaskForLoad(task, NOW_ISO);
        const twice = normalizeTaskForLoad(once, NOW_ISO);

        expect(twice).toEqual(once);
    });

    it('is idempotent for future-start deferred tasks', () => {
        const task = createTask({
            status: 'next',
            isFocusedToday: true,
            focusOrder: 4,
            startTime: '2099-01-01',
        });

        const once = normalizeTaskForLoad(task, NOW_ISO);
        const twice = normalizeTaskForLoad(once, NOW_ISO);

        expect(twice).toEqual(once);
    });
});
