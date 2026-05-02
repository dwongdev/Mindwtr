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

const isSameCalendarDay = (date: Date, otherDate: Date): boolean => (
  date.getFullYear() === otherDate.getFullYear() &&
  date.getMonth() === otherDate.getMonth() &&
  date.getDate() === otherDate.getDate()
);

export const getCalendarWeekInitialVisibleDayIndex = (
  weekDays: Date[],
  selectedDate: Date | null,
  today: Date = new Date(),
): number => {
  const targetDate = selectedDate ?? today;
  const targetIndex = weekDays.findIndex((day) => isSameCalendarDay(day, targetDate));
  if (targetIndex >= 0) return targetIndex;

  const todayIndex = weekDays.findIndex((day) => isSameCalendarDay(day, today));
  return Math.max(0, todayIndex);
};
