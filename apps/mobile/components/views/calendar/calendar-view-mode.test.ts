import { describe, expect, it } from 'vitest';

import {
  coerceCalendarViewMode,
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
});
