import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID, parseIcs, type ExternalCalendarEvent, type ExternalCalendarSubscription } from '@mindwtr/core';

export const EXTERNAL_CALENDARS_KEY = 'mindwtr-external-calendars';

function safeJsonParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export async function getExternalCalendars(): Promise<ExternalCalendarSubscription[]> {
    const raw = await AsyncStorage.getItem(EXTERNAL_CALENDARS_KEY);
    const parsed = safeJsonParse<ExternalCalendarSubscription[]>(raw, []);
    return parsed
        .filter((c) => c && typeof c.url === 'string')
        .map((c) => ({
            id: c.id || generateUUID(),
            name: (c.name || 'Calendar').trim() || 'Calendar',
            url: c.url.trim(),
            enabled: c.enabled !== false,
        }))
        .filter((c) => c.url.length > 0);
}

export async function saveExternalCalendars(calendars: ExternalCalendarSubscription[]): Promise<void> {
    const sanitized = calendars
        .map((c) => ({
            id: c.id || generateUUID(),
            name: (c.name || 'Calendar').trim() || 'Calendar',
            url: (c.url || '').trim(),
            enabled: c.enabled !== false,
        }))
        .filter((c) => c.url.length > 0);
    await AsyncStorage.setItem(EXTERNAL_CALENDARS_KEY, JSON.stringify(sanitized));
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
        const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.text();
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

export async function fetchExternalCalendarEvents(rangeStart: Date, rangeEnd: Date): Promise<{
    calendars: ExternalCalendarSubscription[];
    events: ExternalCalendarEvent[];
}> {
    const calendars = await getExternalCalendars();
    const enabled = calendars.filter((c) => c.enabled);

    const results = await Promise.allSettled(
        enabled.map(async (calendar) => {
            const text = await fetchTextWithTimeout(calendar.url, 15_000);
            return parseIcs(text, { sourceId: calendar.id, rangeStart, rangeEnd });
        })
    );

    const events: ExternalCalendarEvent[] = [];
    for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        events.push(...result.value);
    }

    return { calendars, events };
}

