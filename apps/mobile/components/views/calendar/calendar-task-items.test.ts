import { describe, expect, it } from 'vitest';
import type { Task } from '@mindwtr/core';

import {
  buildScheduledTasksByDate,
  calendarDateKey,
  isAllDayScheduledTask,
  isTimedScheduledTask,
} from './calendar-task-items';

const task = (overrides: Partial<Task>): Task => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  status: overrides.status ?? 'next',
  contexts: [],
  tags: [],
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

describe('calendar task item grouping', () => {
  it('indexes date-only start dates on their local calendar day', () => {
    const dateOnly = task({ id: 'date-only', startTime: '2026-04-20' });
    const timed = task({ id: 'timed', startTime: '2026-04-20T09:00:00' });

    const grouped = buildScheduledTasksByDate([dateOnly, timed]);

    expect(grouped.get(calendarDateKey(new Date(2026, 3, 20)))?.map((item) => item.id)).toEqual([
      'date-only',
      'timed',
    ]);
    expect(isAllDayScheduledTask(dateOnly)).toBe(true);
    expect(isTimedScheduledTask(dateOnly)).toBe(false);
    expect(isTimedScheduledTask(timed)).toBe(true);
  });
});
