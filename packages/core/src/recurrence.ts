import { addDays, addMonths, addWeeks, addYears, format } from 'date-fns';

import { safeParseDate } from './date';
import { generateUUID as uuidv4 } from './uuid';
import type { Recurrence, RecurrenceRule, RecurrenceStrategy, RecurrenceWeekday, Task, TaskStatus, ChecklistItem } from './types';

export const RECURRENCE_RULES: RecurrenceRule[] = ['daily', 'weekly', 'monthly', 'yearly'];

const WEEKDAY_ORDER: RecurrenceWeekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function isRecurrenceRule(value: string | undefined | null): value is RecurrenceRule {
    return !!value && (RECURRENCE_RULES as readonly string[]).includes(value);
}

const RRULE_FREQ_MAP: Record<string, RecurrenceRule> = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
};

const normalizeWeekdays = (days?: string[] | null): RecurrenceWeekday[] | undefined => {
    if (!days || days.length === 0) return undefined;
    const normalized = days
        .map((day) => day.toUpperCase().trim())
        .filter((day) => WEEKDAY_ORDER.includes(day as RecurrenceWeekday)) as RecurrenceWeekday[];
    return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

export function parseRRuleString(rrule: string): { rule?: RecurrenceRule; byDay?: RecurrenceWeekday[] } {
    if (!rrule) return {};
    const tokens = rrule.split(';').reduce<Record<string, string>>((acc, part) => {
        const [key, value] = part.split('=');
        if (key && value) acc[key.toUpperCase()] = value;
        return acc;
    }, {});
    const freq = tokens.FREQ ? RRULE_FREQ_MAP[tokens.FREQ.toUpperCase()] : undefined;
    const byDay = tokens.BYDAY ? normalizeWeekdays(tokens.BYDAY.split(',')) : undefined;
    return { rule: freq, byDay };
}

export function buildRRuleString(rule: RecurrenceRule, byDay?: RecurrenceWeekday[]): string {
    const parts = [`FREQ=${rule.toUpperCase()}`];
    const normalizedDays = normalizeWeekdays(byDay);
    if (rule === 'weekly' && normalizedDays && normalizedDays.length > 0) {
        const ordered = WEEKDAY_ORDER.filter((day) => normalizedDays.includes(day));
        parts.push(`BYDAY=${ordered.join(',')}`);
    }
    return parts.join(';');
}

function getRecurrenceRule(value: Task['recurrence']): RecurrenceRule | null {
    if (!value) return null;
    if (typeof value === 'string') {
        return isRecurrenceRule(value) ? value : null;
    }
    if (typeof value === 'object') {
        const rule = (value as Recurrence).rule;
        if (isRecurrenceRule(rule)) return rule;
        if ((value as Recurrence).rrule) {
            const parsed = parseRRuleString((value as Recurrence).rrule || '');
            if (parsed.rule) return parsed.rule;
        }
    }
    return null;
}

function getRecurrenceStrategy(value: Task['recurrence']): RecurrenceStrategy {
    if (value && typeof value === 'object' && value.strategy === 'fluid') {
        return 'fluid';
    }
    return 'strict';
}

function getRecurrenceByDay(value: Task['recurrence']): RecurrenceWeekday[] | undefined {
    if (!value || typeof value === 'string') return undefined;
    const recurrence = value as Recurrence;
    const explicit = normalizeWeekdays(recurrence.byDay);
    if (explicit && explicit.length > 0) return explicit;
    if (recurrence.rrule) {
        const parsed = parseRRuleString(recurrence.rrule);
        return parsed.byDay;
    }
    return undefined;
}

function addInterval(base: Date, rule: RecurrenceRule): Date {
    switch (rule) {
        case 'daily':
            return addDays(base, 1);
        case 'weekly':
            return addWeeks(base, 1);
        case 'monthly':
            return addMonths(base, 1);
        case 'yearly':
            return addYears(base, 1);
    }
}

function nextWeeklyByDay(base: Date, byDay: RecurrenceWeekday[]): Date {
    const normalizedDays = normalizeWeekdays(byDay);
    if (!normalizedDays || normalizedDays.length === 0) {
        return addWeeks(base, 1);
    }
    const daySet = new Set(normalizedDays);
    for (let offset = 1; offset <= 7; offset += 1) {
        const candidate = addDays(base, offset);
        const weekday = WEEKDAY_ORDER[candidate.getDay()];
        if (daySet.has(weekday)) {
            return candidate;
        }
    }
    return addWeeks(base, 1);
}

function nextIsoFrom(
    baseIso: string | undefined,
    rule: RecurrenceRule,
    fallbackBase: Date,
    byDay?: RecurrenceWeekday[]
): string | undefined {
    const parsed = safeParseDate(baseIso);
    const base = parsed || fallbackBase;
    const effectiveByDay = byDay && byDay.length > 0 ? byDay : undefined;
    const nextDate = rule === 'weekly' && effectiveByDay
        ? nextWeeklyByDay(base, effectiveByDay)
        : addInterval(base, rule);

    // Preserve existing storage format:
    // - If base has timezone/offset, keep ISO (Z/offset).
    // - Otherwise, return local datetime-local compatible string.
    const isDateOnly = !!baseIso && /^\d{4}-\d{2}-\d{2}$/.test(baseIso);
    if (isDateOnly) {
        return format(nextDate, 'yyyy-MM-dd');
    }
    const hasTimezone = !!baseIso && /Z$|[+-]\d{2}:?\d{2}$/.test(baseIso);
    return hasTimezone ? nextDate.toISOString() : format(nextDate, "yyyy-MM-dd'T'HH:mm");
}

function resetChecklist(checklist: ChecklistItem[] | undefined): ChecklistItem[] | undefined {
    if (!checklist || checklist.length === 0) return undefined;
    return checklist.map((item) => ({
        ...item,
        id: uuidv4(),
        isCompleted: false,
    }));
}

/**
 * Create the next instance of a recurring task.
 *
 * - Uses task.dueDate as the base if present/valid, else completion time.
 * - Shifts startTime/reviewAt forward if present.
 * - Resets checklist completion and IDs.
 * - New instance status is based on the previous status, with done -> next.
 */
export function createNextRecurringTask(
    task: Task,
    completedAtIso: string,
    previousStatus: TaskStatus
): Task | null {
    const rule = getRecurrenceRule(task.recurrence);
    if (!rule) return null;
    const strategy = getRecurrenceStrategy(task.recurrence);
    const byDay = getRecurrenceByDay(task.recurrence);
    const completedAtDate = safeParseDate(completedAtIso) || new Date(completedAtIso);
    const baseIso = strategy === 'fluid' ? completedAtIso : task.dueDate;

    const nextDueDate = nextIsoFrom(baseIso, rule, completedAtDate, byDay);
    const nextStartTime = task.startTime
        ? nextIsoFrom(strategy === 'fluid' ? completedAtIso : task.startTime, rule, completedAtDate, byDay)
        : undefined;
    const nextReviewAt = task.reviewAt
        ? nextIsoFrom(strategy === 'fluid' ? completedAtIso : task.reviewAt, rule, completedAtDate, byDay)
        : undefined;

    let newStatus: TaskStatus = previousStatus;
    if (newStatus === 'done') {
        newStatus = 'next';
    }

    return {
        id: uuidv4(),
        title: task.title,
        status: newStatus,
        startTime: nextStartTime,
        dueDate: nextDueDate,
        recurrence: task.recurrence,
        tags: [...(task.tags || [])],
        contexts: [...(task.contexts || [])],
        checklist: resetChecklist(task.checklist),
        description: task.description,
        location: task.location,
        projectId: task.projectId,
        isFocusedToday: false,
        timeEstimate: task.timeEstimate,
        reviewAt: nextReviewAt,
        createdAt: completedAtIso,
        updatedAt: completedAtIso,
    };
}
