import { format, isValid, parseISO } from 'date-fns';

/**
 * Safely formats a date string, handling undefined, null, or invalid dates.
 * 
 * @param dateStr - The date string to format (e.g. ISO string) or Date object
 * @param formatStr - The format string (date-fns format)
 * @param fallback - Optional fallback string (default: '')
 * @returns Formatted date string or fallback
 */
export function safeFormatDate(
    dateStr: string | Date | undefined | null,
    formatStr: string,
    fallback: string = ''
): string {
    if (!dateStr) return fallback;

    try {
        const date = typeof dateStr === 'string' ? safeParseDate(dateStr) : dateStr;
        if (!date || !isValid(date)) return fallback;
        return format(date, formatStr);
    } catch {
        return fallback;
    }
}

/**
 * Safely parses a date string to a Date object.
 * Returns null if invalid.
 */
export function safeParseDate(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    try {
        const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(dateStr);
        if (!hasTimezone) {
            const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?)?$/.exec(dateStr);
            if (match) {
                const year = Number(match[1]);
                const month = Number(match[2]) - 1;
                const day = Number(match[3]);
                const hour = match[4] ? Number(match[4]) : 0;
                const minute = match[5] ? Number(match[5]) : 0;
                const second = match[6] ? Number(match[6]) : 0;
                const ms = match[7] ? Number(match[7].padEnd(3, '0')) : 0;
                const localDate = new Date(year, month, day, hour, minute, second, ms);
                return isValid(localDate) ? localDate : null;
            }
        }
        const date = parseISO(dateStr);
        return isValid(date) ? date : null;
    } catch {
        return null;
    }
}

/**
 * Returns true when the review date is set and due at or before the provided time.
 */
export function isDueForReview(reviewAt: string | Date | undefined | null, now: Date = new Date()): boolean {
    if (!reviewAt) return false;
    const date = typeof reviewAt === 'string' ? safeParseDate(reviewAt) : reviewAt;
    if (!date || !isValid(date)) return false;
    return date.getTime() <= now.getTime();
}
