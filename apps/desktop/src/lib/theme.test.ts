import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemeMode, watchSystemThemePreference } from './theme';

describe('applyThemeMode', () => {
    beforeEach(() => {
        document.documentElement.className = '';
    });

    afterEach(() => {
        document.documentElement.className = '';
    });

    it('applies dark mode when system theme resolves to dark', () => {
        applyThemeMode('system', 'dark');

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark mode when system theme resolves to light', () => {
        document.documentElement.classList.add('dark');

        applyThemeMode('system', 'light');

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
});

describe('watchSystemThemePreference', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        vi.restoreAllMocks();
    });

    it('forwards prefers-color-scheme changes and unsubscribes cleanly', () => {
        const listeners = new Set<(event: { matches: boolean }) => void>();
        const addEventListener = vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.add(listener as unknown as (event: { matches: boolean }) => void);
        });
        const removeEventListener = vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.delete(listener as unknown as (event: { matches: boolean }) => void);
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            media: '(prefers-color-scheme: dark)',
            onchange: null,
            addEventListener,
            removeEventListener,
            addListener: undefined,
            removeListener: undefined,
            dispatchEvent: vi.fn(),
        })) as typeof window.matchMedia;

        const onChange = vi.fn();
        const stopWatching = watchSystemThemePreference(onChange);

        expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        const [listener] = Array.from(listeners);
        expect(listener).toBeTypeOf('function');

        listener({ matches: true });
        listener({ matches: false });

        expect(onChange).toHaveBeenNthCalledWith(1, 'dark');
        expect(onChange).toHaveBeenNthCalledWith(2, 'light');

        stopWatching();

        expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        expect(listeners.size).toBe(0);
    });
});
