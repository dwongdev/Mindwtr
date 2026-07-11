import { describe, expect, it } from 'vitest';
import { getAdvancedReviewDate, getStaleItems, partitionByReviewDate } from './review-utils';
import type { Project, Task } from './types';

const staleUpdatedAt = '2026-01-01T00:00:00.000Z';
const now = new Date('2026-03-01T00:00:00.000Z');

const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Future task',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: staleUpdatedAt,
    updatedAt: staleUpdatedAt,
    ...overrides,
});

const createProject = (overrides: Partial<Project> = {}): Project => ({
    id: 'project-1',
    title: 'Project',
    status: 'active',
    color: '#3B82F6',
    order: 0,
    tagIds: [],
    createdAt: staleUpdatedAt,
    updatedAt: staleUpdatedAt,
    ...overrides,
});

describe('getStaleItems', () => {
    it('includes task and project scheduling dates in stale review snapshots', () => {
        const task = createTask({
            startTime: '2026-01-05T09:00:00.000Z',
            dueDate: '2026-09-05T17:00:00.000Z',
            reviewAt: '2026-02-15T09:00:00.000Z',
        });
        const project = createProject({
            dueDate: '2026-12-01',
            reviewAt: '2026-02-01T09:00:00.000Z',
        });

        const items = getStaleItems([task], [project], 14, now);

        expect(items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'task-1',
                startTime: task.startTime,
                dueDate: task.dueDate,
                reviewAt: task.reviewAt,
            }),
            expect.objectContaining({
                id: 'project:project-1',
                dueDate: project.dueDate,
                reviewAt: project.reviewAt,
            }),
        ]));
    });

    it('skips tasks explicitly deferred with a future review or start date', () => {
        const futureReview = createTask({ id: 'task-review', reviewAt: '2026-11-01' });
        const futureStart = createTask({ id: 'task-start', startTime: '2026-11-01T09:00:00.000Z' });
        const undated = createTask({ id: 'task-undated' });

        const items = getStaleItems([futureReview, futureStart, undated], [], 14, now);

        expect(items.map((item) => item.id)).toEqual(['task-undated']);
    });

    it('does not treat a future due date as a deferral', () => {
        const task = createTask({ id: 'task-due', dueDate: '2026-11-01' });

        const items = getStaleItems([task], [], 14, now);

        expect(items.map((item) => item.id)).toEqual(['task-due']);
    });

    it('skips projects explicitly deferred with a future review date', () => {
        const deferred = createProject({ id: 'project-deferred', reviewAt: '2026-11-01' });
        const undated = createProject({ id: 'project-undated' });

        const items = getStaleItems([], [deferred, undated], 14, now);

        expect(items.map((item) => item.id)).toEqual(['project:project-undated']);
    });
});

describe('partitionByReviewDate', () => {
    it('splits items into due, scheduled, and unscheduled groups', () => {
        const due = createTask({ id: 'task-due', reviewAt: '2026-02-01' });
        const scheduled = createTask({ id: 'task-scheduled', reviewAt: '2026-11-01' });
        const unscheduled = createTask({ id: 'task-unscheduled' });

        const groups = partitionByReviewDate([due, scheduled, unscheduled], now);

        expect(groups.due.map((task) => task.id)).toEqual(['task-due']);
        expect(groups.scheduled.map((task) => task.id)).toEqual(['task-scheduled']);
        expect(groups.unscheduled.map((task) => task.id)).toEqual(['task-unscheduled']);
    });

    it('treats an unparsable review date as unscheduled', () => {
        const broken = createTask({ id: 'task-broken', reviewAt: 'not a date' });

        const groups = partitionByReviewDate([broken], now);

        expect(groups.unscheduled.map((task) => task.id)).toEqual(['task-broken']);
        expect(groups.due).toEqual([]);
        expect(groups.scheduled).toEqual([]);
    });
});

describe('getAdvancedReviewDate', () => {
    const localNow = new Date(2026, 5, 10, 15, 30); // 2026-06-10 15:30 local

    it('returns a date-only value one week out for date-only review dates', () => {
        expect(getAdvancedReviewDate('2026-06-01', localNow)).toBe('2026-06-17');
    });

    it('keeps the original time of day for datetime review dates', () => {
        expect(getAdvancedReviewDate('2026-06-01T09:15', localNow)).toBe('2026-06-17T09:15');
    });

    it('falls back to date-only when the review date is missing or invalid', () => {
        expect(getAdvancedReviewDate(undefined, localNow)).toBe('2026-06-17');
        expect(getAdvancedReviewDate('not a date T00:00', localNow)).toBe('2026-06-17');
    });

    it('advances from now, not from an overdue review date', () => {
        expect(getAdvancedReviewDate('2025-01-01', localNow)).toBe('2026-06-17');
    });

    it('honors a custom day count', () => {
        expect(getAdvancedReviewDate('2026-06-01', localNow, 14)).toBe('2026-06-24');
    });
});
