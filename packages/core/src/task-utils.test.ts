import { describe, it, expect } from 'vitest';
import { sortTasks, getStatusColor, getTaskAgeLabel, rescheduleTask } from './task-utils';
import { Task } from './types';

describe('task-utils', () => {
    describe('sortTasks', () => {
        it('should sort by status order', () => {
            const tasks: Partial<Task>[] = [
                { id: '1', status: 'next', title: 'Next', createdAt: '2023-01-01' },
                { id: '2', status: 'inbox', title: 'Inbox', createdAt: '2023-01-01' },
                { id: '3', status: 'done', title: 'Done', createdAt: '2023-01-01' },
            ];

            const sorted = sortTasks(tasks as Task[]);
            expect(sorted.map(t => t.status)).toEqual(['inbox', 'next', 'done']);
        });

        it('should sort by due date within status', () => {
            const tasks: Partial<Task>[] = [
                { id: '1', status: 'next', title: 'Later', dueDate: '2023-01-02', createdAt: '2023-01-01' },
                { id: '2', status: 'next', title: 'Soon', dueDate: '2023-01-01', createdAt: '2023-01-01' },
                { id: '3', status: 'next', title: 'No Date', createdAt: '2023-01-01' },
            ];

            const sorted = sortTasks(tasks as Task[]);
            expect(sorted.map(t => t.title)).toEqual(['Soon', 'Later', 'No Date']);
        });
    });

    describe('getStatusColor', () => {
        it('should return valid color object', () => {
            const color = getStatusColor('todo');
            expect(color).toHaveProperty('bg');
            expect(color).toHaveProperty('text');
            expect(color).toHaveProperty('border');
        });

        it('should default to inbox color for unknown', () => {
            // @ts-ignore
            const color = getStatusColor('unknown');
            const inboxColor = getStatusColor('inbox');
            expect(color).toEqual(inboxColor);
        });
    });

    describe('getTaskAgeLabel', () => {
        it('should return null for new tasks', () => {
            const now = new Date().toISOString();
            expect(getTaskAgeLabel(now)).toBeNull();
        });

        it('should return correct label for old tasks', () => {
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            expect(getTaskAgeLabel(twoWeeksAgo.toISOString())).toBe('2 weeks old');
        });
    });

    describe('rescheduleTask', () => {
        it('increments pushCount when dueDate moves later', () => {
            const task: Task = {
                id: '1',
                title: 'Reschedule',
                status: 'next',
                tags: [],
                contexts: [],
                dueDate: '2025-01-01T09:00:00.000Z',
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-01T00:00:00.000Z',
            };
            const updated = rescheduleTask(task, '2025-01-02T09:00:00.000Z');
            expect(updated.pushCount).toBe(1);
        });

        it('does not increment pushCount when dueDate moves earlier', () => {
            const task: Task = {
                id: '2',
                title: 'Reschedule earlier',
                status: 'next',
                tags: [],
                contexts: [],
                dueDate: '2025-01-03T09:00:00.000Z',
                pushCount: 2,
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-01T00:00:00.000Z',
            };
            const updated = rescheduleTask(task, '2025-01-02T09:00:00.000Z');
            expect(updated.pushCount).toBe(2);
        });
    });
});
