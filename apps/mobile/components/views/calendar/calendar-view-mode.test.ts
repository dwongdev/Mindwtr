import { describe, expect, it } from 'vitest';

import {
  coerceCalendarViewMode,
  getCalendarWeekInitialVisibleDayIndex,
  getInitialCalendarSelectedDate,
  needsCalendarSelectedDate,
} from './calendar-view-mode';

describe('calendar view mode helpers', () => {
  it('coerces unsupported stored values to month', () => {
    expect(coerceCalendarViewMode('day')).toBe('day');
    expect(coerceCalendarViewMode('week')).toBe('week');
    expect(coerceCalendarViewMode('schedule')).toBe('schedule');
    expect(coerceCalendarViewMode('agenda')).toBe('month');
    expect(coerceCalendarViewMode(undefined)).toBe('month');
  });

  it('requires a selected date for date-specific views', () => {
    expect(needsCalendarSelectedDate('day')).toBe(true);
    expect(needsCalendarSelectedDate('week')).toBe(true);
    expect(needsCalendarSelectedDate('month')).toBe(false);
    expect(needsCalendarSelectedDate('schedule')).toBe(false);
  });

  it('starts persisted day and week views on today', () => {
    const today = new Date('2026-05-01T12:00:00.000Z');

    expect(getInitialCalendarSelectedDate('day', today)?.toISOString()).toBe('2026-05-01T12:00:00.000Z');
    expect(getInitialCalendarSelectedDate('week', today)?.toISOString()).toBe('2026-05-01T12:00:00.000Z');
    expect(getInitialCalendarSelectedDate('month', today)).toBeNull();
  });

  it('chooses the selected day as the initial visible week column', () => {
    const weekDays = Array.from({ length: 7 }, (_, index) => new Date(2026, 3, 27 + index));

    expect(getCalendarWeekInitialVisibleDayIndex(weekDays, new Date(2026, 4, 1, 12))).toBe(4);
  });

  it('falls back to today for the initial visible week column', () => {
    const weekDays = Array.from({ length: 7 }, (_, index) => new Date(2026, 3, 27 + index));

    expect(getCalendarWeekInitialVisibleDayIndex(weekDays, null, new Date(2026, 4, 2, 12))).toBe(5);
    expect(getCalendarWeekInitialVisibleDayIndex(weekDays, null, new Date(2026, 4, 10, 12))).toBe(0);
  });
});
