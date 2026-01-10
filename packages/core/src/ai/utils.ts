export function parseJson<T>(raw: string, validator?: (value: unknown) => value is T): T {
    const trimmed = raw.trim();
    if (!trimmed) {
        throw new Error('AI response was empty.');
    }
    const cleaned = trimmed
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
    try {
        const parsed = JSON.parse(cleaned) as unknown;
        if (validator && !validator(parsed)) {
            throw new Error('AI response failed validation.');
        }
        return parsed as T;
    } catch (error) {
        const objectStart = cleaned.indexOf('{');
        const objectEnd = cleaned.lastIndexOf('}');
        if (objectStart !== -1 && objectEnd > objectStart) {
            const sliced = cleaned.slice(objectStart, objectEnd + 1);
            const parsed = JSON.parse(sliced) as unknown;
            if (validator && !validator(parsed)) {
                throw new Error('AI response failed validation.');
            }
            return parsed as T;
        }
        const arrayStart = cleaned.indexOf('[');
        const arrayEnd = cleaned.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd > arrayStart) {
            const sliced = cleaned.slice(arrayStart, arrayEnd + 1);
            const parsed = JSON.parse(sliced) as unknown;
            if (validator && !validator(parsed)) {
                throw new Error('AI response failed validation.');
            }
            return parsed as T;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`AI JSON parse error: ${message}.`);
    }
}

const TIME_ESTIMATE_MAP: Record<string, string> = {
    '5m': '5min',
    '5min': '5min',
    '10m': '10min',
    '10min': '10min',
    '15m': '15min',
    '15min': '15min',
    '30m': '30min',
    '30min': '30min',
    '1h': '1hr',
    '1hr': '1hr',
    '2h': '2hr',
    '2hr': '2hr',
    '3h': '3hr',
    '3hr': '3hr',
    '4h': '4hr',
    '4hr': '4hr',
    '4h+': '4hr+',
    '4hr+': '4hr+',
};

export function normalizeTimeEstimate(value?: string): string | undefined {
    if (!value) return undefined;
    const key = value.trim().toLowerCase();
    return TIME_ESTIMATE_MAP[key];
}

export function normalizeTags(tags?: string[] | null): string[] {
    if (!tags || tags.length === 0) return [];
    const normalized = tags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
    return Array.from(new Set(normalized));
}

export async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    label: string,
    externalSignal?: AbortSignal
): Promise<Response> {
    const abortController = typeof AbortController === 'function' ? new AbortController() : null;
    let removeExternalListener: (() => void) | null = null;
    if (abortController && externalSignal) {
        const onAbort = () => abortController.abort();
        if (externalSignal.aborted) {
            abortController.abort();
        } else {
            externalSignal.addEventListener('abort', onAbort);
            removeExternalListener = () => externalSignal.removeEventListener('abort', onAbort);
        }
    }
    const timeoutId = abortController ? setTimeout(() => abortController.abort(), timeoutMs) : null;
    try {
        return await fetch(url, { ...init, signal: abortController?.signal ?? init.signal });
    } catch (error) {
        if (abortController?.signal.aborted) {
            if (externalSignal?.aborted) {
                throw new Error(`${label} request aborted`);
            }
            throw new Error(`${label} request timed out`);
        }
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (removeExternalListener) removeExternalListener();
    }
}

const lastRequestAt = new Map<string, number>();

export async function rateLimit(key: string, minIntervalMs = 250): Promise<void> {
    const now = Date.now();
    const last = lastRequestAt.get(key) ?? 0;
    const waitMs = minIntervalMs - (now - last);
    if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastRequestAt.set(key, Date.now());
}
