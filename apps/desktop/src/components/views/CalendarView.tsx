import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, getMonth, getYear, isSameDay, isSameMonth, isToday, setMonth, setYear, startOfMonth, startOfWeek, subDays, subMonths, subWeeks, eachDayOfInterval } from 'date-fns';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { findFreeSlotForDay as findCalendarFreeSlotForDay, isSlotFreeForDay as isCalendarSlotFreeForDay, shallow, safeFormatDate, safeParseDate, safeParseDueDate, timeEstimateToMinutes as resolveTimeEstimateToMinutes, translateWithFallback, type ExternalCalendarEvent, type ExternalCalendarSubscription, useTaskStore, type Task, isTaskInActiveProject } from '@mindwtr/core';
import { useLanguage } from '../../contexts/language-context';
import { cn } from '../../lib/utils';
import { reportError } from '../../lib/report-error';
import { logError } from '../../lib/app-log';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { checkBudget } from '../../config/performanceBudgets';
import { TaskItem } from '../TaskItem';
import { resolveAreaFilter, taskMatchesAreaFilter } from '../../lib/area-filter';
import { fetchExternalCalendarEvents, summarizeExternalCalendarWarnings } from '../../lib/external-calendar-events';
import { getCalendarMonthNames, getCalendarWeekdayHeaders, resolveCalendarLocale } from './calendar-locale';

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

type CalendarCellItem =
    | { id: string; kind: 'scheduled'; task: Task; start: Date | null; title: string }
    | { id: string; kind: 'deadline'; task: Task; start: Date | null; title: string }
    | { id: string; kind: 'event'; event: ExternalCalendarEvent; start: Date | null; title: string };

type CalendarViewMode = 'day' | 'week' | 'month' | 'schedule';

type CalendarTimedItem =
    | { durationMinutes: number; end: Date; id: string; kind: 'task'; start: Date; task: Task; title: string }
    | { durationMinutes: number; end: Date; event: ExternalCalendarEvent; id: string; kind: 'event'; start: Date; title: string };

const DESKTOP_DAY_START_HOUR = 8;
const DESKTOP_DAY_END_HOUR = 23;
const DESKTOP_HOUR_HEIGHT = 56;
const DESKTOP_GRID_SNAP_MINUTES = 15;

const hashString = (value: string): number => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
};

const externalCalendarColor = (sourceId: string): string => {
    const hue = hashString(sourceId || 'calendar') % 360;
    return `hsl(${hue} 68% 48%)`;
};

const parseCalendarDateParam = (value: string | null): Date | null => {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const next = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(next.getTime())) return null;
    return next;
};

const parseCalendarViewMode = (value: string | null): CalendarViewMode => (
    value === 'day' || value === 'week' || value === 'schedule' ? value : 'month'
);

const getInitialCalendarState = (fallback: Date): { currentMonth: Date; selectedDate: Date | null; viewMode: CalendarViewMode } => {
    if (typeof window === 'undefined') {
        return { currentMonth: fallback, selectedDate: null, viewMode: 'month' };
    }
    const params = new URLSearchParams(window.location.search);
    const selectedDate = parseCalendarDateParam(params.get('calendarDate'));
    const monthDate = parseCalendarDateParam(`${params.get('calendarMonth') ?? ''}-01`);
    return {
        currentMonth: selectedDate ?? monthDate ?? fallback,
        selectedDate,
        viewMode: parseCalendarViewMode(params.get('calendarView')),
    };
};

export function CalendarView() {
    const perf = usePerformanceMonitor('CalendarView');
    const { tasks, areas, updateTask, settings, getDerivedState } = useTaskStore(
        (state) => ({
            tasks: state.tasks,
            areas: state.areas,
            updateTask: state.updateTask,
            settings: state.settings,
            getDerivedState: state.getDerivedState,
        }),
        shallow
    );
    const { projectMap } = getDerivedState();
    const { t, language } = useLanguage();
    const resolveText = useCallback(
        (key: string, fallback: string) => {
            return translateWithFallback(t, key, fallback);
        },
        [t]
    );
    const timeEstimatesEnabled = settings?.features?.timeEstimates !== false;
    const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
    const resolvedAreaFilter = useMemo(
        () => resolveAreaFilter(settings?.filters?.areaId, areas),
        [settings?.filters?.areaId, areas],
    );
    const weekStartsOn = settings?.weekStart === 'monday' ? 1 : 0;
    const calendarLocale = useMemo(
        () => resolveCalendarLocale({
            language,
            dateFormat: settings?.dateFormat,
            systemLocale: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : undefined,
        }),
        [language, settings?.dateFormat]
    );
    const [initialCalendarState] = useState(() => getInitialCalendarState(new Date()));
    const [currentMonth, setCurrentMonth] = useState(initialCalendarState.currentMonth);
    const [selectedDate, setSelectedDate] = useState<Date | null>(initialCalendarState.selectedDate);
    const [viewMode, setViewMode] = useState<CalendarViewMode>(initialCalendarState.viewMode);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [viewFilterQuery, setViewFilterQuery] = useState('');
    const [scheduleQuery, setScheduleQuery] = useState('');
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [externalCalendars, setExternalCalendars] = useState<ExternalCalendarSubscription[]>([]);
    const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);
    const [hiddenExternalCalendarIds, setHiddenExternalCalendarIds] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            const raw = window.localStorage.getItem('mindwtr.calendar.hiddenExternalCalendars');
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
        } catch {
            return new Set();
        }
    });
    const [externalError, setExternalError] = useState<string | null>(null);
    const [isExternalLoading, setIsExternalLoading] = useState(false);
    const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null);
    const [editingTimeValue, setEditingTimeValue] = useState<string>('');
    const calendarBodyRef = useRef<HTMLDivElement | null>(null);
    const normalizedViewFilterQuery = viewFilterQuery.trim().toLowerCase();

    useEffect(() => {
        if (!perf.enabled) return;
        const timer = window.setTimeout(() => {
            checkBudget('CalendarView', perf.metrics, 'complex');
        }, 0);
        return () => window.clearTimeout(timer);
    }, [perf.enabled]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('calendarMonth', format(currentMonth, 'yyyy-MM'));
        if (selectedDate) {
            url.searchParams.set('calendarDate', dayKey(selectedDate));
        } else {
            url.searchParams.delete('calendarDate');
        }
        url.searchParams.set('calendarView', viewMode);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }, [currentMonth, selectedDate, viewMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('mindwtr.calendar.hiddenExternalCalendars', JSON.stringify([...hiddenExternalCalendarIds]));
    }, [hiddenExternalCalendarIds]);

    const calendarStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn });
    const calendarEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn });
    const days = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd,
    });
    const visibleRange = useMemo(() => {
        if (viewMode === 'day') {
            return { start: currentMonth, end: currentMonth };
        }
        if (viewMode === 'week') {
            const start = startOfWeek(currentMonth, { weekStartsOn });
            return { start, end: addDays(start, 6) };
        }
        if (viewMode === 'schedule') {
            return { start: currentMonth, end: addDays(currentMonth, 60) };
        }
        return { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) };
    }, [currentMonth, viewMode, weekStartsOn]);
    const timelineDays = useMemo(
        () => viewMode === 'day'
            ? [currentMonth]
            : eachDayOfInterval({
                start: startOfWeek(currentMonth, { weekStartsOn }),
                end: addDays(startOfWeek(currentMonth, { weekStartsOn }), 6),
            }),
        [currentMonth, viewMode, weekStartsOn]
    );
    const scheduleDays = useMemo(
        () => eachDayOfInterval({ start: visibleRange.start, end: visibleRange.end }),
        [visibleRange]
    );

    const isCalendarTaskVisible = (task: Task) => {
        if (task.deletedAt) return false;
        if (task.status === 'done' || task.status === 'archived' || task.status === 'reference') return false;
        if (!isTaskInActiveProject(task, projectMap)) return false;
        if (!taskMatchesAreaFilter(task, resolvedAreaFilter, projectMap, areaById)) return false;
        if (normalizedViewFilterQuery && !task.title.toLowerCase().includes(normalizedViewFilterQuery)) return false;
        return true;
    };

    const calendarTaskData = useMemo(() => {
        const visibleTasks: Task[] = [];
        const deadlinesByDay = new Map<string, Task[]>();
        const scheduledByDay = new Map<string, Task[]>();
        for (const task of tasks) {
            if (!isCalendarTaskVisible(task)) continue;
            visibleTasks.push(task);
            if (task.dueDate) {
                const dueDate = safeParseDueDate(task.dueDate);
                if (dueDate) {
                    const dueKey = dayKey(dueDate);
                    const existingDue = deadlinesByDay.get(dueKey);
                    if (existingDue) existingDue.push(task);
                    else deadlinesByDay.set(dueKey, [task]);
                }
            }
            if (task.startTime) {
                const startTime = safeParseDate(task.startTime);
                if (startTime) {
                    const startKey = dayKey(startTime);
                    const existingStart = scheduledByDay.get(startKey);
                    if (existingStart) existingStart.push(task);
                    else scheduledByDay.set(startKey, [task]);
                }
            }
        }
        return { visibleTasks, deadlinesByDay, scheduledByDay };
    }, [tasks, projectMap, resolvedAreaFilter, areaById, normalizedViewFilterQuery]);

    const getDeadlinesForDay = (date: Date) => calendarTaskData.deadlinesByDay.get(dayKey(date)) ?? [];
    const getScheduledForDay = (date: Date) => calendarTaskData.scheduledByDay.get(dayKey(date)) ?? [];
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const openTask = openTaskId ? tasks.find((task) => task.id === openTaskId) ?? null : null;
    const openProject = openTask?.projectId ? projectMap.get(openTask.projectId) : undefined;
    const openTaskFromCalendar = useCallback((task: Task) => {
        setOpenTaskId(task.id);
    }, []);
    const markTaskDone = useCallback((taskId: string) => {
        updateTask(taskId, { status: 'done', isFocusedToday: false })
            .catch((error) => reportError('Failed to mark task done', error));
    }, [updateTask]);

    const visibleExternalEvents = useMemo(
        () => externalEvents.filter((event) => !hiddenExternalCalendarIds.has(event.sourceId)),
        [externalEvents, hiddenExternalCalendarIds]
    );

    const externalEventsByDay = useMemo(() => {
        const nextMap = new Map<string, ExternalCalendarEvent[]>();
        for (const event of visibleExternalEvents) {
            const start = safeParseDate(event.start);
            const end = safeParseDate(event.end);
            if (!start || !end) continue;

            const lastMoment = new Date(Math.max(start.getTime(), end.getTime() - 1));
            const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const lastDay = new Date(lastMoment.getFullYear(), lastMoment.getMonth(), lastMoment.getDate());

            while (cursor.getTime() <= lastDay.getTime()) {
                const key = dayKey(cursor);
                const existing = nextMap.get(key);
                if (existing) existing.push(event);
                else nextMap.set(key, [event]);
                cursor.setDate(cursor.getDate() + 1);
            }
        }
        return nextMap;
    }, [visibleExternalEvents]);

    const getExternalEventsForDay = useCallback(
        (date: Date) => externalEventsByDay.get(dayKey(date)) ?? [],
        [externalEventsByDay]
    );

    const timeEstimateToMinutes = (estimate: Task['timeEstimate']): number => (
        resolveTimeEstimateToMinutes(estimate, { enabled: timeEstimatesEnabled })
    );

    const getSchedulingTasks = () => tasks.filter((task) => isCalendarTaskVisible(task));

    const findFreeSlotForDay = (day: Date, durationMinutes: number, excludeTaskId?: string): Date | null => (
        findCalendarFreeSlotForDay({
            day,
            durationMinutes,
            events: getExternalEventsForDay(day),
            excludeTaskId,
            tasks: getSchedulingTasks(),
            timeEstimatesEnabled,
        })
    );

    const isSlotFreeForDay = (day: Date, startTime: Date, durationMinutes: number, excludeTaskId?: string): boolean => (
        isCalendarSlotFreeForDay({
            day,
            durationMinutes,
            events: getExternalEventsForDay(day),
            excludeTaskId,
            startTime,
            tasks: getSchedulingTasks(),
            timeEstimatesEnabled,
        })
    );

    const calendarNameById = useMemo(() => new Map(externalCalendars.map((c) => [c.id, c.name])), [externalCalendars]);

    useEffect(() => {
        setEditingTimeTaskId(null);
        setEditingTimeValue('');
    }, [selectedDate]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsExternalLoading(true);
            setExternalError(null);
            try {
                const rangeStart = new Date(visibleRange.start);
                rangeStart.setHours(0, 0, 0, 0);
                const rangeEnd = new Date(visibleRange.end);
                rangeEnd.setHours(23, 59, 59, 999);
                const { calendars, events, warnings } = await fetchExternalCalendarEvents(rangeStart, rangeEnd);
                if (cancelled) return;
                setExternalCalendars(calendars);
                setExternalEvents(events);
                setExternalError(summarizeExternalCalendarWarnings(warnings));
            } catch (error) {
                if (cancelled) return;
                const message = error instanceof Error && error.message.trim()
                    ? error.message.trim()
                    : 'Failed to load external calendars.';
                void logError(error, { scope: 'calendar', step: 'loadExternalCalendars' });
                setExternalError(message);
                setExternalEvents([]);
            } finally {
                if (!cancelled) {
                    setIsExternalLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [visibleRange]);

    const scheduleCandidates = useMemo(() => {
        if (!selectedDate) return [];
        const query = scheduleQuery.trim().toLowerCase();
        if (!query) return [];

        return calendarTaskData.visibleTasks
            .filter((task) => {
                if (task.status !== 'next') return false;
                return task.title.toLowerCase().includes(query);
            })
            .slice(0, 12);
    }, [calendarTaskData.visibleTasks, scheduleQuery, selectedDate]);

    useEffect(() => {
        if (!selectedDate) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!calendarBodyRef.current || calendarBodyRef.current.contains(target)) return;
            setSelectedDate(null);
            setScheduleQuery('');
            setScheduleError(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedDate]);

    const scheduleTaskOnSelectedDate = (taskId: string) => {
        if (!selectedDate) return;
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        const durationMinutes = timeEstimateToMinutes(task.timeEstimate);
        const slot = findFreeSlotForDay(selectedDate, durationMinutes, taskId);
        if (!slot) {
            setScheduleError(t('calendar.noFreeTime'));
            return;
        }

        updateTask(taskId, { startTime: slot.toISOString() })
            .catch((error) => reportError('Failed to update scheduled time', error));
        setScheduleQuery('');
        setScheduleError(null);
    };

    const beginEditScheduledTime = (taskId: string) => {
        if (!selectedDate) return;
        const task = tasks.find((t) => t.id === taskId);
        if (!task?.startTime) return;
        const start = safeParseDate(task.startTime);
        if (!start) return;
        setEditingTimeTaskId(taskId);
        setEditingTimeValue(format(start, 'HH:mm'));
    };

    const commitEditScheduledTime = async () => {
        if (!selectedDate) return;
        if (!editingTimeTaskId) return;
        const task = tasks.find((t) => t.id === editingTimeTaskId);
        if (!task) return;

        const [hh, mm] = editingTimeValue.split(':').map((v) => Number(v));
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;

        const nextStart = new Date(selectedDate);
        nextStart.setHours(hh, mm, 0, 0);

        const durationMinutes = timeEstimateToMinutes(task.timeEstimate);
        const ok = isSlotFreeForDay(selectedDate, nextStart, durationMinutes, task.id);
        if (!ok) {
            setScheduleError(t('calendar.overlapWarning'));
            return;
        }

        await updateTask(task.id, { startTime: nextStart.toISOString() });
        setEditingTimeTaskId(null);
        setEditingTimeValue('');
        setScheduleError(null);
    };

    const openQuickAddForDate = (date: Date) => {
        const durationMinutes = 30;
        const slot = findFreeSlotForDay(date, durationMinutes);
        const fallback = new Date(date);
        fallback.setHours(9, 0, 0, 0);
        const start = slot ?? fallback;
        window.dispatchEvent(new CustomEvent('mindwtr:quick-add', {
            detail: {
                initialProps: { startTime: start.toISOString() },
            },
        }));
    };

    const openQuickAddForStart = (start: Date) => {
        window.dispatchEvent(new CustomEvent('mindwtr:quick-add', {
            detail: {
                initialProps: { startTime: start.toISOString(), timeEstimate: '30min' },
            },
        }));
    };

    const cancelEditScheduledTime = () => {
        setEditingTimeTaskId(null);
        setEditingTimeValue('');
    };
    const monthNames = useMemo(() => getCalendarMonthNames(calendarLocale), [calendarLocale]);
    const weekdayHeaders = useMemo(
        () => getCalendarWeekdayHeaders(calendarLocale, weekStartsOn as 0 | 1),
        [calendarLocale, weekStartsOn]
    );
    const currentYear = getYear(currentMonth);
    const currentMonthLabel = (() => {
        if (viewMode === 'day') return format(currentMonth, 'EEEE, MMMM d, yyyy');
        if (viewMode === 'week') {
            const start = startOfWeek(currentMonth, { weekStartsOn });
            const end = addDays(start, 6);
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        if (viewMode === 'schedule') {
            return `${format(visibleRange.start, 'MMM d')} - ${format(visibleRange.end, 'MMM d, yyyy')}`;
        }
        return format(currentMonth, 'MMMM yyyy');
    })();
    const yearOptions = useMemo(
        () => Array.from({ length: 11 }, (_, index) => currentYear - 5 + index),
        [currentYear]
    );
    const resetSelectedDayState = () => {
        setScheduleQuery('');
        setScheduleError(null);
        setEditingTimeTaskId(null);
        setEditingTimeValue('');
    };
    const selectCalendarDate = (date: Date) => {
        setSelectedDate(date);
        if (!isSameMonth(date, currentMonth)) {
            setCurrentMonth(date);
        }
    };
    const handleMonthChange = (monthIndex: number) => {
        setSelectedDate(null);
        resetSelectedDayState();
        setCurrentMonth((prev) => setMonth(prev, monthIndex));
    };
    const handleYearChange = (yearValue: number) => {
        setSelectedDate(null);
        resetSelectedDayState();
        setCurrentMonth((prev) => setYear(prev, yearValue));
    };
    const handlePrevMonth = () => {
        setSelectedDate(null);
        resetSelectedDayState();
        setIsMonthPickerOpen(false);
        setCurrentMonth((prev) => {
            if (viewMode === 'day') return subDays(prev, 1);
            if (viewMode === 'week') return subWeeks(prev, 1);
            if (viewMode === 'schedule') return subWeeks(prev, 2);
            return subMonths(prev, 1);
        });
    };
    const handleNextMonth = () => {
        setSelectedDate(null);
        resetSelectedDayState();
        setIsMonthPickerOpen(false);
        setCurrentMonth((prev) => {
            if (viewMode === 'day') return addDays(prev, 1);
            if (viewMode === 'week') return addWeeks(prev, 1);
            if (viewMode === 'schedule') return addWeeks(prev, 2);
            return addMonths(prev, 1);
        });
    };
    const handleToday = () => {
        const nextToday = new Date();
        setCurrentMonth(nextToday);
        setSelectedDate(null);
        resetSelectedDayState();
        setIsMonthPickerOpen(false);
    };
    const handleViewModeChange = (nextMode: CalendarViewMode) => {
        setViewMode(nextMode);
        if (nextMode !== 'month' && selectedDate) {
            setCurrentMonth(selectedDate);
        }
        setIsMonthPickerOpen(false);
    };
    const toggleExternalCalendar = (calendarId: string) => {
        setHiddenExternalCalendarIds((prev) => {
            const next = new Set(prev);
            if (next.has(calendarId)) next.delete(calendarId);
            else next.add(calendarId);
            return next;
        });
    };
    const selectedExternalEvents = selectedDate ? getExternalEventsForDay(selectedDate) : [];
    const selectedAllDayEvents = selectedExternalEvents.filter((event) => event.allDay);
    const selectedTimedEvents = selectedExternalEvents.filter((event) => !event.allDay);
    const selectedDeadlines = selectedDate ? getDeadlinesForDay(selectedDate) : [];
    const selectedScheduled = selectedDate ? getScheduledForDay(selectedDate) : [];
    const selectedTaskRows = [
        ...selectedScheduled.map((task) => ({
            id: `scheduled-${task.id}`,
            kind: 'scheduled' as const,
            task,
            start: task.startTime ? safeParseDate(task.startTime) : null,
        })),
        ...selectedDeadlines
            .filter((task) => !selectedScheduled.some((scheduledTask) => scheduledTask.id === task.id))
            .map((task) => ({
                id: `deadline-${task.id}`,
                kind: 'deadline' as const,
                task,
                start: task.dueDate ? safeParseDueDate(task.dueDate) : null,
            })),
    ].sort((a, b) => {
        const aTime = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return a.task.title.localeCompare(b.task.title);
    });
    const getCalendarItemsForDate = (date: Date): CalendarCellItem[] => {
        const scheduled = getScheduledForDay(date);
        const scheduledIds = new Set(scheduled.map((task) => task.id));
        const deadlineOnly = getDeadlinesForDay(date).filter((task) => !scheduledIds.has(task.id));
        return [
            ...scheduled.map((task) => ({
                id: `scheduled-${task.id}`,
                kind: 'scheduled' as const,
                task,
                start: task.startTime ? safeParseDate(task.startTime) : null,
                title: task.title,
            })),
            ...deadlineOnly.map((task) => ({
                id: `deadline-${task.id}`,
                kind: 'deadline' as const,
                task,
                start: task.dueDate ? safeParseDueDate(task.dueDate) : null,
                title: task.title,
            })),
            ...getExternalEventsForDay(date).map((event) => ({
                id: `event-${event.id}`,
                kind: 'event' as const,
                event,
                start: safeParseDate(event.start),
                title: event.title,
            })),
        ].sort((a, b) => {
            const aTime = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const bTime = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
            if (aTime !== bTime) return aTime - bTime;
            return a.title.localeCompare(b.title);
        });
    };
    const getAllDayItemsForDay = (date: Date) => {
        const scheduledIds = new Set(getScheduledForDay(date).map((task) => task.id));
        return [
            ...getDeadlinesForDay(date)
                .filter((task) => !scheduledIds.has(task.id))
                .map((task) => ({ id: `deadline-${task.id}`, kind: 'deadline' as const, task, title: task.title })),
            ...getExternalEventsForDay(date)
                .filter((event) => event.allDay)
                .map((event) => ({ id: `event-${event.id}`, kind: 'event' as const, event, title: event.title })),
        ];
    };
    const getTimedItemsForDay = (date: Date): CalendarTimedItem[] => {
        const dayStart = new Date(date);
        dayStart.setHours(DESKTOP_DAY_START_HOUR, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(DESKTOP_DAY_END_HOUR, 0, 0, 0);
        const items: CalendarTimedItem[] = [];

        for (const task of getScheduledForDay(date)) {
            const start = task.startTime ? safeParseDate(task.startTime) : null;
            if (!start) continue;
            const durationMinutes = timeEstimateToMinutes(task.timeEstimate);
            items.push({
                durationMinutes,
                end: new Date(start.getTime() + durationMinutes * 60_000),
                id: `task-${task.id}`,
                kind: 'task',
                start,
                task,
                title: task.title,
            });
        }

        for (const event of getExternalEventsForDay(date)) {
            if (event.allDay) continue;
            const rawStart = safeParseDate(event.start);
            const rawEnd = safeParseDate(event.end);
            if (!rawStart || !rawEnd) continue;
            const start = new Date(Math.max(rawStart.getTime(), dayStart.getTime()));
            const end = new Date(Math.min(rawEnd.getTime(), dayEnd.getTime()));
            if (end <= start) continue;
            items.push({
                durationMinutes: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
                end,
                event,
                id: `event-${event.id}`,
                kind: 'event',
                start,
                title: event.title,
            });
        }

        return items.sort((a, b) => {
            const startDelta = a.start.getTime() - b.start.getTime();
            if (startDelta !== 0) return startDelta;
            return b.durationMinutes - a.durationMinutes;
        });
    };
    const layoutTimedItems = (date: Date) => {
        const columnEnds: number[] = [];
        const positioned = getTimedItemsForDay(date).map((item) => {
            const startMs = item.start.getTime();
            const column = columnEnds.findIndex((endMs) => endMs <= startMs);
            const columnIndex = column >= 0 ? column : columnEnds.length;
            columnEnds[columnIndex] = item.end.getTime();
            return { ...item, columnIndex };
        });
        const columnCount = Math.max(1, columnEnds.length);
        return positioned.map((item) => ({
            ...item,
            columnCount,
            height: Math.max(24, item.durationMinutes / 60 * DESKTOP_HOUR_HEIGHT),
            leftPercent: item.columnIndex * (100 / columnCount),
            top: Math.max(0, ((item.start.getHours() - DESKTOP_DAY_START_HOUR) * 60 + item.start.getMinutes()) / 60 * DESKTOP_HOUR_HEIGHT),
            widthPercent: 100 / columnCount,
        }));
    };

    useEffect(() => {
        const handleCalendarShortcut = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target;
            if (target instanceof HTMLElement) {
                const tag = target.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) return;
            }

            const consume = () => {
                event.preventDefault();
                event.stopPropagation();
            };

            switch (event.key) {
                case 't':
                    consume();
                    handleToday();
                    break;
                case 'd':
                    consume();
                    handleViewModeChange('day');
                    break;
                case 'w':
                    consume();
                    handleViewModeChange('week');
                    break;
                case 'm':
                    consume();
                    handleViewModeChange('month');
                    break;
                case 'a':
                    consume();
                    handleViewModeChange('schedule');
                    break;
                case 'ArrowLeft':
                    consume();
                    handlePrevMonth();
                    break;
                case 'ArrowRight':
                    consume();
                    handleNextMonth();
                    break;
                case 'n':
                    consume();
                    openQuickAddForDate(selectedDate ?? currentMonth);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleCalendarShortcut, true);
        return () => window.removeEventListener('keydown', handleCalendarShortcut, true);
    }, [currentMonth, selectedDate, viewMode]);

    return (
        <ErrorBoundary>
            <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">{t('nav.calendar')}</h2>
                    <p className="text-sm text-muted-foreground">
                        {resolveText('calendar.tasksAndEvents', 'Tasks and external events by date')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleToday}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                        {resolveText('calendar.today', 'Today')}
                    </button>
                    <div className="inline-flex rounded-md border border-border bg-card p-1">
                        {([
                            ['day', resolveText('calendar.day', 'Day')],
                            ['week', resolveText('calendar.week', 'Week')],
                            ['month', resolveText('calendar.month', 'Month')],
                            ['schedule', resolveText('calendar.schedule', 'Schedule')],
                        ] as Array<[CalendarViewMode, string]>).map(([mode, label]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => handleViewModeChange(mode)}
                                className={cn(
                                    "h-7 rounded px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
                                    viewMode === mode
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            aria-label={resolveText('calendar.prevMonth', 'Previous month')}
                            title={resolveText('calendar.prevMonth', 'Previous month')}
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsMonthPickerOpen((open) => !open)}
                                className="h-8 min-w-[11rem] rounded px-3 text-sm font-semibold hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                                aria-haspopup="dialog"
                                aria-expanded={isMonthPickerOpen}
                            >
                                {currentMonthLabel}
                            </button>
                            {isMonthPickerOpen && (
                                <div className="absolute right-0 top-10 z-20 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="space-y-1 text-xs font-medium text-muted-foreground">
                                            {resolveText('calendar.month', 'Month')}
                                            <select
                                                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                value={getMonth(currentMonth)}
                                                onChange={(event) => handleMonthChange(Number(event.target.value))}
                                                aria-label={resolveText('calendar.month', 'Month')}
                                            >
                                                {monthNames.map((label, index) => (
                                                    <option key={label} value={index}>{label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="space-y-1 text-xs font-medium text-muted-foreground">
                                            {resolveText('calendar.year', 'Year')}
                                            <select
                                                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                value={currentYear}
                                                onChange={(event) => handleYearChange(Number(event.target.value))}
                                                aria-label={resolveText('calendar.year', 'Year')}
                                            >
                                                {yearOptions.map((year) => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            aria-label={resolveText('calendar.nextMonth', 'Next month')}
                            title={resolveText('calendar.nextMonth', 'Next month')}
                        >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>
            <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                    type="text"
                    data-view-filter-input
                    placeholder={t('common.search')}
                    value={viewFilterQuery}
                    onChange={(event) => setViewFilterQuery(event.target.value)}
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
            </div>

            {externalError && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                    {externalError}
                </div>
            )}

            {externalCalendars.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                        {resolveText('calendar.visibleCalendars', 'Calendars')}
                    </span>
                    {externalCalendars.map((calendar) => {
                        const hidden = hiddenExternalCalendarIds.has(calendar.id);
                        return (
                            <button
                                key={calendar.id}
                                type="button"
                                onClick={() => toggleExternalCalendar(calendar.id)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
                                    hidden
                                        ? "border-border bg-muted/40 text-muted-foreground"
                                        : "border-border bg-background text-foreground"
                                )}
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: hidden ? 'hsl(var(--muted-foreground))' : externalCalendarColor(calendar.id) }}
                                    aria-hidden="true"
                                />
                                {calendar.name}
                            </button>
                        );
                    })}
                </div>
            )}

            <div ref={calendarBodyRef} className="space-y-6">
                {viewMode === 'month' && (
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden shadow-sm">
                    {weekdayHeaders.map((day) => (
                        <div key={day} className="bg-card p-2 text-center text-sm font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}

                    {days.map((day, _dayIdx) => {
                        const deadlines = getDeadlinesForDay(day);
                        const scheduled = getScheduledForDay(day);
                        const scheduledIds = new Set(scheduled.map((task) => task.id));
                        const deadlineOnly = deadlines.filter((task) => !scheduledIds.has(task.id));
                        const dayEvents = getExternalEventsForDay(day);
                        const cellItems: CalendarCellItem[] = [
                            ...scheduled.map((task) => ({
                                id: `scheduled-${task.id}`,
                                kind: 'scheduled' as const,
                                task,
                                start: task.startTime ? safeParseDate(task.startTime) : null,
                                title: task.title,
                            })),
                            ...deadlineOnly.map((task) => ({
                                id: `deadline-${task.id}`,
                                kind: 'deadline' as const,
                                task,
                                start: task.dueDate ? safeParseDueDate(task.dueDate) : null,
                                title: task.title,
                            })),
                            ...dayEvents.map((event) => ({
                                id: `event-${event.id}`,
                                kind: 'event' as const,
                                event,
                                start: safeParseDate(event.start),
                                title: event.title,
                            })),
                        ].sort((a, b) => {
                            const aTime = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
                            const bTime = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
                            if (aTime !== bTime) return aTime - bTime;
                            return a.title.localeCompare(b.title);
                        });
                        const visibleItems = cellItems.slice(0, 3);
                        const overflowCount = Math.max(0, cellItems.length - visibleItems.length);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const todayMarkerStyle = isToday(day)
                            ? {
                                backgroundColor: 'hsl(var(--primary))',
                                color: 'hsl(var(--primary-foreground))',
                            }
                            : undefined;

                        return (
                            <div
                                key={day.toString()}
                                className={cn(
                                    "group bg-card min-h-[128px] p-2 transition-colors hover:bg-accent/50 relative",
                                    !isSameMonth(day, currentMonth) && "bg-muted/50 text-muted-foreground",
                                    isSelected && "ring-2 ring-primary"
                                )}
                                onClick={() => selectCalendarDate(day)}
                            >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium" style={todayMarkerStyle}>
                                            <span className="tabular-nums leading-none">
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        {isToday(day) && (
                                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-normal text-primary">
                                                {resolveText('calendar.today', 'Today')}
                                            </span>
                                        )}
                                    </div>
                                    {isSelected && <div className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                                </div>

                                <div className="space-y-1">
                                    {visibleItems.map((item) => {
                                        const timeLabel = item.start && (item.kind === 'scheduled' || (item.kind === 'event' && !item.event.allDay))
                                            ? safeFormatDate(item.start, 'p')
                                            : item.kind === 'event' && item.event.allDay
                                                ? t('calendar.allDay')
                                                : '';
                                        const content = (
                                            <>
                                                {timeLabel && <span className="mr-1 text-[10px] opacity-75">{timeLabel}</span>}
                                                <span>{item.title}</span>
                                            </>
                                        );

                                        if (item.kind === 'event') {
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="truncate rounded border-l-[3px] bg-muted/70 px-1.5 py-1 text-xs text-muted-foreground"
                                                    style={{ borderLeftColor: externalCalendarColor(item.event.sourceId) }}
                                                    title={item.title}
                                                >
                                                    {content}
                                                </div>
                                            );
                                        }

                                        const task = item.task;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                data-task-id={task.id}
                                                data-task-edit-trigger
                                                className={cn(
                                                    "block w-full truncate rounded px-1.5 py-1 text-left text-xs focus:outline-none focus:ring-2 focus:ring-primary/40",
                                                    item.kind === 'scheduled'
                                                        ? "bg-primary/10 text-primary"
                                                        : "border-l-[3px] border-destructive/70 bg-background/60 text-foreground"
                                                )}
                                                title={task.title}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openTaskFromCalendar(task);
                                                }}
                                            >
                                                {content}
                                            </button>
                                        );
                                    })}
                                    {overflowCount > 0 && (
                                        <div className="px-1.5 pt-0.5 text-[11px] font-medium text-muted-foreground">
                                            +{overflowCount} {resolveText('calendar.more', 'more')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}

                {(viewMode === 'day' || viewMode === 'week') && (
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div
                            className="grid border-b border-border bg-muted/40"
                            style={{ gridTemplateColumns: `4rem repeat(${timelineDays.length}, minmax(0, 1fr))` }}
                        >
                            <div className="border-r border-border p-2 text-xs font-medium text-muted-foreground">
                                {resolveText('calendar.time', 'Time')}
                            </div>
                            {timelineDays.map((day) => (
                                <button
                                    key={dayKey(day)}
                                    type="button"
                                    onClick={() => selectCalendarDate(day)}
                                    className={cn(
                                        "border-r border-border p-2 text-left last:border-r-0 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40",
                                        isToday(day) && "bg-primary/5"
                                    )}
                                >
                                    <div className="text-xs font-medium text-muted-foreground">{format(day, 'EEE')}</div>
                                    <div className={cn("mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-semibold", isToday(day) && "bg-primary text-primary-foreground")}>
                                        {format(day, 'd')}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div
                            className="grid border-b border-border"
                            style={{ gridTemplateColumns: `4rem repeat(${timelineDays.length}, minmax(0, 1fr))` }}
                        >
                            <div className="border-r border-border p-2 text-xs font-medium text-muted-foreground">
                                {t('calendar.allDay')}
                            </div>
                            {timelineDays.map((day) => {
                                const allDayItems = getAllDayItemsForDay(day).slice(0, 4);
                                return (
                                    <div key={dayKey(day)} className="min-h-12 space-y-1 border-r border-border p-2 last:border-r-0">
                                        {allDayItems.map((item) => {
                                            if (item.kind === 'event') {
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="truncate rounded border-l-[3px] bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
                                                        style={{ borderLeftColor: externalCalendarColor(item.event.sourceId) }}
                                                        title={item.title}
                                                    >
                                                        {item.title}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    data-task-id={item.task.id}
                                                    data-task-edit-trigger
                                                    onClick={() => openTaskFromCalendar(item.task)}
                                                    className="block w-full truncate rounded border-l-[3px] border-destructive/70 bg-background/70 px-2 py-1 text-left text-xs hover:bg-muted"
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid" style={{ gridTemplateColumns: `4rem repeat(${timelineDays.length}, minmax(0, 1fr))` }}>
                            <div className="relative border-r border-border bg-muted/20" style={{ height: (DESKTOP_DAY_END_HOUR - DESKTOP_DAY_START_HOUR) * DESKTOP_HOUR_HEIGHT }}>
                                {Array.from({ length: DESKTOP_DAY_END_HOUR - DESKTOP_DAY_START_HOUR + 1 }, (_, index) => {
                                    const hour = DESKTOP_DAY_START_HOUR + index;
                                    return (
                                        <div key={hour} className="absolute right-2 -translate-y-2 text-[11px] text-muted-foreground" style={{ top: index * DESKTOP_HOUR_HEIGHT }}>
                                            {safeFormatDate(new Date(2026, 0, 1, hour), 'p')}
                                        </div>
                                    );
                                })}
                            </div>
                            {timelineDays.map((day) => {
                                const now = new Date();
                                const nowMinutes = (now.getHours() - DESKTOP_DAY_START_HOUR) * 60 + now.getMinutes();
                                const nowTop = nowMinutes / 60 * DESKTOP_HOUR_HEIGHT;
                                const showNow = isToday(day) && nowMinutes >= 0 && nowMinutes <= (DESKTOP_DAY_END_HOUR - DESKTOP_DAY_START_HOUR) * 60;
                                return (
                                    <div
                                        key={dayKey(day)}
                                        className={cn("relative border-r border-border last:border-r-0", isToday(day) && "bg-primary/5")}
                                        style={{ height: (DESKTOP_DAY_END_HOUR - DESKTOP_DAY_START_HOUR) * DESKTOP_HOUR_HEIGHT }}
                                        onClick={(event) => {
                                            const rect = event.currentTarget.getBoundingClientRect();
                                            const rawMinutes = ((event.clientY - rect.top) / DESKTOP_HOUR_HEIGHT) * 60;
                                            const snapped = Math.round(rawMinutes / DESKTOP_GRID_SNAP_MINUTES) * DESKTOP_GRID_SNAP_MINUTES;
                                            const maxMinutes = (DESKTOP_DAY_END_HOUR - DESKTOP_DAY_START_HOUR) * 60 - 30;
                                            const clamped = Math.max(0, Math.min(maxMinutes, snapped));
                                            const start = new Date(day);
                                            start.setHours(DESKTOP_DAY_START_HOUR, clamped, 0, 0);
                                            openQuickAddForStart(start);
                                        }}
                                    >
                                        {Array.from({ length: DESKTOP_DAY_END_HOUR - DESKTOP_DAY_START_HOUR + 1 }, (_, index) => (
                                            <div
                                                key={index}
                                                className="absolute left-0 right-0 border-t border-border/70"
                                                style={{ top: index * DESKTOP_HOUR_HEIGHT }}
                                            />
                                        ))}
                                        {showNow && (
                                            <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
                                                <span className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
                                                <span className="h-0.5 flex-1 bg-red-500" />
                                            </div>
                                        )}
                                        {layoutTimedItems(day).map((item) => {
                                            const timeLabel = `${safeFormatDate(item.start, 'p')}-${safeFormatDate(item.end, 'p')}`;
                                            const commonStyle = {
                                                height: item.height,
                                                left: `calc(${item.leftPercent}% + 3px)`,
                                                top: item.top,
                                                width: `calc(${item.widthPercent}% - 6px)`,
                                            };
                                            if (item.kind === 'event') {
                                                return (
                                                    <div
                                                        key={item.id}
                                                        data-calendar-block
                                                        className="absolute z-10 overflow-hidden rounded border-l-[4px] bg-muted/80 px-2 py-1 text-xs text-muted-foreground shadow-sm"
                                                        style={{ ...commonStyle, borderLeftColor: externalCalendarColor(item.event.sourceId) }}
                                                        title={`${item.title} ${timeLabel}`}
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <div className="truncate font-medium text-foreground">{item.title}</div>
                                                        <div className="truncate">{timeLabel}</div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    data-calendar-block
                                                    data-task-id={item.task.id}
                                                    data-task-edit-trigger
                                                    className="absolute z-10 overflow-hidden rounded bg-primary px-2 py-1 text-left text-xs text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                    style={commonStyle}
                                                    title={`${item.title} ${timeLabel}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openTaskFromCalendar(item.task);
                                                    }}
                                                >
                                                    <div className="truncate font-semibold">{item.title}</div>
                                                    <div className="truncate opacity-90">{timeLabel}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'schedule' && (
                    <div className="rounded-lg border border-border bg-card">
                        <div className="border-b border-border px-4 py-3">
                            <div className="text-sm font-semibold">{resolveText('calendar.schedule', 'Schedule')}</div>
                            <div className="text-xs text-muted-foreground">{currentMonthLabel}</div>
                        </div>
                        <div className="divide-y divide-border">
                            {scheduleDays.map((day) => {
                                const items = getCalendarItemsForDate(day);
                                if (items.length === 0) return null;
                                return (
                                    <section key={dayKey(day)} className="grid gap-3 px-4 py-3 md:grid-cols-[9rem_minmax(0,1fr)]">
                                        <div>
                                            <div className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>{format(day, 'EEE, MMM d')}</div>
                                            {isToday(day) && <div className="mt-1 text-xs font-medium text-primary">{resolveText('calendar.today', 'Today')}</div>}
                                        </div>
                                        <div className="space-y-1">
                                            {items.map((item) => {
                                                const timeLabel = item.start && (item.kind === 'scheduled' || (item.kind === 'event' && !item.event.allDay))
                                                    ? safeFormatDate(item.start, 'p')
                                                    : item.kind === 'event' && item.event.allDay
                                                        ? t('calendar.allDay')
                                                        : t('calendar.deadline');
                                                if (item.kind === 'event') {
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="flex items-center gap-3 rounded border-l-[3px] bg-muted/50 px-3 py-2 text-sm"
                                                            style={{ borderLeftColor: externalCalendarColor(item.event.sourceId) }}
                                                        >
                                                            <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{timeLabel}</span>
                                                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        data-task-id={item.task.id}
                                                        data-task-edit-trigger
                                                        onClick={() => openTaskFromCalendar(item.task)}
                                                        className={cn(
                                                            "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40",
                                                            item.kind === 'scheduled' ? "bg-primary/10 text-primary" : "border-l-[3px] border-destructive/70 bg-background"
                                                        )}
                                                    >
                                                        <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{timeLabel}</span>
                                                        <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </div>
                )}

                {selectedDate && (
                    <div className="rounded-lg border border-border bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                            <div>
                                <div className="text-sm font-semibold">{format(selectedDate, 'PPPP')}</div>
                                <div className="text-xs text-muted-foreground">
                                    {selectedTaskRows.length + selectedExternalEvents.length} {resolveText('calendar.items', 'items')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    onClick={() => openQuickAddForDate(selectedDate)}
                                >
                                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t('calendar.addTask')}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    onClick={() => {
                                        setSelectedDate(null);
                                        resetSelectedDayState();
                                    }}
                                    aria-label={t('common.close')}
                                    title={t('common.close')}
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                            <div className="space-y-5">
                                {selectedAllDayEvents.length > 0 && (
                                    <section className="space-y-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t('calendar.allDay')}</h3>
                                        <div className="space-y-1">
                                            {selectedAllDayEvents.map((event) => {
                                                const sourceLabel = calendarNameById.get(event.sourceId);
                                                return (
                                                    <div
                                                        key={event.id}
                                                        className="flex items-center gap-3 rounded-md border-l-[3px] bg-muted/50 px-3 py-2 text-sm"
                                                        style={{ borderLeftColor: externalCalendarColor(event.sourceId) }}
                                                    >
                                                        <span className="min-w-0 flex-1 truncate">{event.title}</span>
                                                        {sourceLabel && <span className="truncate text-xs text-muted-foreground">{sourceLabel}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                <section className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t('calendar.events')}</h3>
                                    <div className="space-y-1">
                                        {isExternalLoading && (
                                            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                                {resolveText('common.loading', 'Loading...')}
                                            </div>
                                        )}
                                        {selectedTimedEvents.map((event) => {
                                            const start = safeParseDate(event.start);
                                            const end = safeParseDate(event.end);
                                            const timeLabel = start && end
                                                ? `${safeFormatDate(start, 'p')}-${safeFormatDate(end, 'p')}`
                                                : '';
                                            const sourceLabel = calendarNameById.get(event.sourceId);
                                            return (
                                                <div
                                                    key={event.id}
                                                    className="flex items-center gap-3 rounded-md border-l-[3px] bg-muted/50 px-3 py-2 text-sm"
                                                    style={{ borderLeftColor: externalCalendarColor(event.sourceId) }}
                                                >
                                                    <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{timeLabel}</span>
                                                    <span className="min-w-0 flex-1 truncate">{event.title}</span>
                                                    {sourceLabel && <span className="truncate text-xs text-muted-foreground">{sourceLabel}</span>}
                                                </div>
                                            );
                                        })}
                                        {!isExternalLoading && selectedTimedEvents.length === 0 && (
                                            <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                                {t('calendar.noTasks')}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{resolveText('calendar.tasks', 'Tasks')}</h3>
                                    <div className="space-y-1">
                                        {selectedTaskRows.map(({ id, kind, task, start }) => {
                                            const durationMinutes = timeEstimateToMinutes(task.timeEstimate);
                                            const end = start && kind === 'scheduled'
                                                ? new Date(start.getTime() + durationMinutes * 60 * 1000)
                                                : null;
                                            const timeLabel = start && end
                                                ? `${safeFormatDate(start, 'p')}-${safeFormatDate(end, 'p')}`
                                                : kind === 'deadline'
                                                    ? t('calendar.deadline')
                                                    : '';
                                            const isEditing = editingTimeTaskId === task.id;

                                            return (
                                                <div
                                                    key={id}
                                                    data-task-id={task.id}
                                                    className={cn(
                                                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                                                        kind === 'scheduled' ? "bg-primary/5" : "border-l-[3px] border-destructive/70 bg-background/60"
                                                    )}
                                                >
                                                    <button
                                                        type="button"
                                                        data-task-edit-trigger
                                                        onClick={() => openTaskFromCalendar(task)}
                                                        className="min-w-0 flex-1 truncate text-left text-foreground focus:outline-none focus:underline"
                                                    >
                                                        <span className="mr-2 inline-flex w-28 items-center gap-1 text-xs font-medium text-muted-foreground">
                                                            {kind === 'scheduled' && <Clock className="h-3 w-3" aria-hidden="true" />}
                                                            {timeLabel}
                                                        </span>
                                                        {task.title}
                                                    </button>
                                                    {isEditing ? (
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            <input
                                                                type="time"
                                                                value={editingTimeValue}
                                                                onChange={(e) => setEditingTimeValue(e.target.value)}
                                                                className="h-8 rounded border border-border bg-background px-2 text-xs"
                                                            />
                                                            <button
                                                                type="button"
                                                                className="h-8 rounded bg-primary px-2 text-xs text-primary-foreground"
                                                                onClick={commitEditScheduledTime}
                                                            >
                                                                {t('common.save')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="h-8 rounded bg-muted px-2 text-xs hover:bg-muted/80"
                                                                onClick={cancelEditScheduledTime}
                                                            >
                                                                {t('common.cancel')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                                            <button
                                                                type="button"
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                                                                onClick={() => markTaskDone(task.id)}
                                                                aria-label={t('status.done')}
                                                                title={t('status.done')}
                                                            >
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            </button>
                                                            {kind === 'scheduled' && (
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground"
                                                                    onClick={() => beginEditScheduledTime(task.id)}
                                                                    aria-label={t('common.edit')}
                                                                    title={t('common.edit')}
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                                                </button>
                                                            )}
                                                            {kind === 'scheduled' && (
                                                                <button
                                                                    type="button"
                                                                    className="h-8 rounded-md bg-muted px-2 text-xs text-muted-foreground hover:text-foreground"
                                                                    onClick={() => updateTask(task.id, { startTime: undefined })
                                                                        .catch((error) => reportError('Failed to clear scheduled time', error))}
                                                                    title={t('calendar.unschedule')}
                                                                >
                                                                    {t('calendar.unschedule')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {selectedTaskRows.length === 0 && (
                                            <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                                {t('calendar.noTasks')}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <aside className="space-y-3 rounded-lg border border-border bg-background/60 p-3">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                                        {t('calendar.scheduleResults')}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {resolveText('calendar.scheduleHelp', 'Find a next task and place it in the first open slot.')}
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={scheduleQuery}
                                    onChange={(e) => {
                                        setScheduleQuery(e.target.value);
                                        if (scheduleError) setScheduleError(null);
                                    }}
                                    placeholder={t('calendar.schedulePlaceholder')}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                {scheduleError && (
                                    <div className="text-xs text-red-400">{scheduleError}</div>
                                )}
                                {scheduleCandidates.length > 0 && (
                                    <div className="space-y-1">
                                        {scheduleCandidates.map((task) => (
                                            <button
                                                key={task.id}
                                                type="button"
                                                className="block w-full truncate rounded-md bg-muted px-2 py-1.5 text-left text-xs hover:bg-muted/80"
                                                onClick={() => scheduleTaskOnSelectedDate(task.id)}
                                                title={task.title}
                                            >
                                                {task.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </aside>
                        </div>
                    </div>
                )}
            {openTask && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
                    <div
                        className="absolute inset-0"
                        onClick={() => setOpenTaskId(null)}
                    />
                    <div className="relative w-full max-w-3xl bg-background border border-border rounded-xl shadow-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">{t('taskEdit.editTask') || 'Task'}</h3>
                            <button
                                type="button"
                                onClick={() => setOpenTaskId(null)}
                                className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                        <TaskItem
                            task={openTask}
                            project={openProject}
                            showQuickDone={false}
                            readOnly={false}
                            compactMetaEnabled={true}
                        />
                    </div>
                </div>
            )}
        </div>
        </div>
        </ErrorBoundary>
    );
}
