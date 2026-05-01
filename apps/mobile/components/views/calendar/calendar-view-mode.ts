export type CalendarViewMode = 'month' | 'day' | 'week' | 'schedule';

export const coerceCalendarViewMode = (value?: string | null): CalendarViewMode => (
  value === 'day' || value === 'week' || value === 'schedule' ? value : 'month'
);

export const needsCalendarSelectedDate = (viewMode: CalendarViewMode): boolean => (
  viewMode === 'day' || viewMode === 'week'
);

export const getInitialCalendarSelectedDate = (
  viewMode: CalendarViewMode,
  today: Date = new Date(),
): Date | null => (
  needsCalendarSelectedDate(viewMode) ? new Date(today) : null
);
