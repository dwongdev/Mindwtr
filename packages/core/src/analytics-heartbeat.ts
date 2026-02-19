type StorageLike = {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
};

type HeartbeatFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type SendDailyHeartbeatOptions = {
    endpointUrl?: string | null;
    distinctId?: string | null;
    platform?: string | null;
    channel?: string | null;
    appVersion?: string | null;
    deviceClass?: string | null;
    osMajor?: string | null;
    locale?: string | null;
    storage: StorageLike;
    storageKey?: string;
    enabled?: boolean;
    timeoutMs?: number;
    fetcher?: HeartbeatFetch;
    now?: () => Date;
};

export const HEARTBEAT_LAST_SENT_DAY_KEY = 'mindwtr-analytics-last-heartbeat-day';

const trimValue = (value: string | null | undefined): string => String(value ?? '').trim();

const getIsoDay = (now: Date): string => now.toISOString().slice(0, 10);

const parseEndpoint = (value: string): string | null => {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        if (!parsed.protocol || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return null;
        return parsed.toString();
    } catch {
        return null;
    }
};

export async function sendDailyHeartbeat(options: SendDailyHeartbeatOptions): Promise<boolean> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
        if (!options || options.enabled === false) return false;

        const endpoint = parseEndpoint(trimValue(options.endpointUrl));
        const distinctId = trimValue(options.distinctId);
        const platform = trimValue(options.platform);
        const channel = trimValue(options.channel);
        const appVersion = trimValue(options.appVersion);
        const deviceClass = trimValue(options.deviceClass);
        const osMajor = trimValue(options.osMajor);
        const locale = trimValue(options.locale);
        const storage = options.storage;

        if (
            !endpoint
            || !distinctId
            || !platform
            || !channel
            || !appVersion
            || !storage
            || typeof storage.getItem !== 'function'
            || typeof storage.setItem !== 'function'
        ) {
            return false;
        }

        const storageKey = trimValue(options.storageKey) || HEARTBEAT_LAST_SENT_DAY_KEY;
        const now = options.now ? options.now() : new Date();
        const today = getIsoDay(now);
        const lastSentDay = await storage.getItem(storageKey);
        if (lastSentDay === today) return false;

        const fetcher: HeartbeatFetch = options.fetcher ?? (globalThis.fetch as HeartbeatFetch);
        if (typeof fetcher !== 'function') return false;

        const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(500, options.timeoutMs as number) : 5_000;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        timeout = controller
            ? setTimeout(() => controller.abort(), timeoutMs)
            : null;

        const payload: Record<string, string> = {
            distinct_id: distinctId,
            platform,
            channel,
            app_version: appVersion,
            // Compatibility for servers that still expect `version`.
            version: appVersion,
        };
        if (deviceClass) payload.device_class = deviceClass;
        if (osMajor) payload.os_major = osMajor;
        if (locale) payload.locale = locale;

        const response = await fetcher(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) return false;
        await storage.setItem(storageKey, today);
        return true;
    } catch {
        return false;
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}
