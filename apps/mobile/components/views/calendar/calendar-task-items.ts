import { hasTimeComponent, safeParseDate, type Task } from '@mindwtr/core';

export const calendarDateKey = (date: Date): string => (
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
);

export const addCalendarMapItem = <T,>(map: Map<string, T[]>, date: Date, item: T) => {
  const key = calendarDateKey(date);
  const items = map.get(key);
  if (items) {
    items.push(item);
    return;
  }
  map.set(key, [item]);
};

export const isTimedScheduledTask = (task: Pick<Task, 'startTime'>): boolean => (
  hasTimeComponent(task.startTime)
);

export const isAllDayScheduledTask = (task: Pick<Task, 'startTime'>): boolean => (
  Boolean(task.startTime) && !hasTimeComponent(task.startTime)
);

export const buildScheduledTasksByDate = (tasks: readonly Task[]): Map<string, Task[]> => {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.startTime) continue;
    const startTime = safeParseDate(task.startTime);
    if (startTime) addCalendarMapItem(map, startTime, task);
  }
  return map;
};
