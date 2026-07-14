import { describe, expect, it } from 'vitest';
import type { Task } from '@mindwtr/core';

import { applyTaskDraftDateFieldUpdates } from './task-edit-draft-adapter';

const baseTask: Task = {
    id: 'task-1',
    title: 'Plan launch',
    status: 'next',
    tags: [],
    contexts: [],
    startTime: '2026-07-14T09:00:00.000Z',
    dueDate: '2026-07-18',
    reviewAt: '2026-07-16',
    relativeStartOffset: { amount: -4, unit: 'day' },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
};

describe('applyTaskDraftDateFieldUpdates', () => {
    it('leaves non-date edits on the zero-churn legacy path', () => {
        const next = { ...baseTask, title: 'Plan launch v2' };

        expect(applyTaskDraftDateFieldUpdates(baseTask, next, baseTask)).toBe(next);
    });

    it('applies an atomic date batch through TaskDraft without changing its legacy shape', () => {
        const next: Partial<Task> = {
            ...baseTask,
            dueDate: '2026-07-20',
            startTime: '2026-07-17',
            relativeStartOffset: { amount: -3, unit: 'day' },
        };

        expect(applyTaskDraftDateFieldUpdates(baseTask, next, baseTask)).toEqual(next);
    });

    it('maps TaskDraft empty date values back to explicit legacy clears', () => {
        const next: Partial<Task> = {
            ...baseTask,
            startTime: undefined,
            dueDate: undefined,
            reviewAt: undefined,
            relativeStartOffset: undefined,
        };

        expect(applyTaskDraftDateFieldUpdates(baseTask, next, baseTask)).toMatchObject({
            startTime: undefined,
            dueDate: undefined,
            reviewAt: undefined,
            relativeStartOffset: undefined,
        });
    });

    it('falls back unchanged before an editor base task exists', () => {
        const next: Partial<Task> = { dueDate: '2026-07-20' };

        expect(applyTaskDraftDateFieldUpdates({}, next, null)).toBe(next);
    });
});
