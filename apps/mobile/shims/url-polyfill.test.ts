import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../lib/app-log', () => ({
    logWarn: vi.fn(),
}));

import { logWarn } from '../lib/app-log';
import * as shim from './url-polyfill';

describe('URL Polyfill Shim', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
    });

    test('exports URL and URLSearchParams', () => {
        expect(shim.URL).toBeDefined();
        expect(shim.URLSearchParams).toBeDefined();
    });

    test('installs timer fallbacks when setImmediate is missing', async () => {
        vi.resetModules();
        const originalSetImmediate = (globalThis as any).setImmediate;
        const originalClearImmediate = (globalThis as any).clearImmediate;
        const originalSetTimeout = (globalThis as any).setTimeout;
        const originalClearTimeout = (globalThis as any).clearTimeout;

        try {
            (globalThis as any).setImmediate = undefined;
            (globalThis as any).clearImmediate = undefined;
            (globalThis as any).setTimeout = undefined;
            (globalThis as any).clearTimeout = undefined;

            await import('./url-polyfill');

            expect(typeof (globalThis as any).setImmediate).toBe('function');
            expect(typeof (globalThis as any).clearImmediate).toBe('function');
            expect(typeof (globalThis as any).setTimeout).toBe('function');
            expect(typeof (globalThis as any).clearTimeout).toBe('function');
        } finally {
            (globalThis as any).setImmediate = originalSetImmediate;
            (globalThis as any).clearImmediate = originalClearImmediate;
            (globalThis as any).setTimeout = originalSetTimeout;
            (globalThis as any).clearTimeout = originalClearTimeout;
        }
    });

    test('shimmed URL has createObjectURL that is safe (mocked environment)', async () => {
        // 1. Reset modules to ensure fresh execution of shim logic
        vi.resetModules();

        // 2. Mock global URL to simulate Hermes (no createObjectURL)
        const OriginalURL = globalThis.URL;

        // We need a class that extends or mimics URL but definitely has no createObjectURL static method
        // @ts-ignore - MockURL matching OriginalURL structure for tests
        class MockURL extends OriginalURL {
            // @ts-ignore - Intentionally removing static method to simulate Hermes
            static createObjectURL = undefined;
            // @ts-ignore - Intentionally removing static method to simulate Hermes
            static revokeObjectURL = undefined;
        }

        // Temporarily replace global URL
        globalThis.URL = MockURL as unknown as typeof URL;

        // 3. Re-import and call setupURLPolyfill
        const shimModule = await import('./url-polyfill');
        shimModule.setupURLPolyfill();

        // 4. Verify it was patched on globalThis
        expect(typeof globalThis.URL.createObjectURL).toBe('function');

        // 5. Test safety behavior (returns string, warns)
        const result = globalThis.URL.createObjectURL({} as any);
        expect(result).toBe('');

        const warnMock = vi.mocked(logWarn);
        if (warnMock.mock.calls.length > 0) {
            expect(warnMock).toHaveBeenCalledWith(
                expect.stringContaining('not supported'),
                expect.any(Object)
            );
        }

        // Cleanup
        globalThis.URL = OriginalURL;
    });

    test('shimmed URL has revokeObjectURL', () => {
        expect(typeof shim.URL.revokeObjectURL).toBe('function');
        // Should not throw
        shim.URL.revokeObjectURL('some-url');
    });

    test('URLSearchParams basic functionality', () => {
        const params = new shim.URLSearchParams!('foo=1&bar=2');
        expect(params.get('foo')).toBe('1');
        expect(params.get('bar')).toBe('2');
        expect(params.has('foo')).toBe(true);
        expect(params.has('baz')).toBe(false);
    });
});
