import { describe, expect, it } from 'vitest';
import type { Task } from '@mindwtr/core';

import {
    buildDesktopTaskNotificationBody,
    resolveDesktopTaskReminderKind,
} from './notification-service';

const baseTask: Task = {
    id: 'task-1',
    title: 'Prepare report',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
};

const translations = {
    'settings.startDateNotifications': 'Start date reminders',
    'settings.dueDateNotifications': 'Due date reminders',
    'settings.reviewAtNotifications': 'Review date reminders',
    'settings.notifications': 'Notifications',
};

describe('desktop notification service', () => {
    it('identifies start, due, and review task reminder kinds', () => {
        const task: Task = {
            ...baseTask,
            startTime: '2026-05-23T09:00:00.000Z',
            dueDate: '2026-05-23T17:00:00.000Z',
            reviewAt: '2026-05-24T10:00:00.000Z',
        };

        expect(resolveDesktopTaskReminderKind(task, new Date('2026-05-23T09:00:00.000Z'))).toBe('start');
        expect(resolveDesktopTaskReminderKind(task, new Date('2026-05-23T17:00:00.000Z'))).toBe('due');
        expect(resolveDesktopTaskReminderKind(task, new Date('2026-05-24T10:00:00.000Z'))).toBe('review');
    });

    it('includes the reminder type before the task description', () => {
        const task: Task = {
            ...baseTask,
            dueDate: '2026-05-23T17:00:00.000Z',
            description: '**Bring** notes',
        };

        expect(buildDesktopTaskNotificationBody(
            task,
            new Date('2026-05-23T17:00:00.000Z'),
            translations,
        )).toBe('Due date reminders\nBring notes');
    });

    it('still shows the reminder type when the task has no description', () => {
        const task: Task = {
            ...baseTask,
            startTime: '2026-05-23T09:00:00.000Z',
        };

        expect(buildDesktopTaskNotificationBody(
            task,
            new Date('2026-05-23T09:00:00.000Z'),
            translations,
        )).toBe('Start date reminders');
    });
});
