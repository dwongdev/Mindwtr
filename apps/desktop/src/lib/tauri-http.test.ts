import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSupportedProxyUrl, normalizeProxyUrl, syncNativeProxyUrl, withTauriHttpProxy } from './tauri-http';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

const isTauriRuntimeMock = vi.fn(() => true);
vi.mock('./runtime', () => ({
    isTauriRuntime: () => isTauriRuntimeMock(),
}));

describe('tauri http proxy helpers', () => {
    it('normalizes proxy URLs from settings input', () => {
        expect(normalizeProxyUrl('  http://proxy.local:8080  ')).toBe('http://proxy.local:8080');
        expect(normalizeProxyUrl(undefined)).toBe('');
        expect(normalizeProxyUrl(42)).toBe('');
    });

    it('accepts blank, http, and https proxy URLs only', () => {
        expect(isSupportedProxyUrl('')).toBe(true);
        expect(isSupportedProxyUrl(' http://proxy.local:8080 ')).toBe(true);
        expect(isSupportedProxyUrl('https://proxy.local:8443')).toBe(true);
        expect(isSupportedProxyUrl('socks5://proxy.local:1080')).toBe(false);
        expect(isSupportedProxyUrl('proxy.local:8080')).toBe(false);
    });

    it('leaves fetch unchanged when no proxy is configured', () => {
        const baseFetch = vi.fn() as unknown as typeof fetch;

        expect(withTauriHttpProxy(baseFetch, '   ')).toBe(baseFetch);
    });

    it('adds the proxy to Tauri fetch options while preserving existing init fields', async () => {
        const response = new Response('ok');
        const baseFetch = vi.fn(async () => response) as unknown as typeof fetch;
        const proxiedFetch = withTauriHttpProxy(baseFetch, ' http://proxy.local:8080 ');

        await proxiedFetch('https://example.com/data.ics', {
            method: 'GET',
            headers: { Accept: 'text/calendar' },
        });

        expect(baseFetch).toHaveBeenCalledWith('https://example.com/data.ics', {
            method: 'GET',
            headers: { Accept: 'text/calendar' },
            proxy: { all: 'http://proxy.local:8080' },
        });
    });

    describe('syncNativeProxyUrl', () => {
        beforeEach(() => {
            invokeMock.mockReset();
            isTauriRuntimeMock.mockReturnValue(true);
        });

        it('mirrors the saved proxy into the native config', async () => {
            await syncNativeProxyUrl(' http://proxy.local:8080 ');

            expect(invokeMock).toHaveBeenCalledWith('set_network_proxy', {
                proxyUrl: 'http://proxy.local:8080',
            });
        });

        it('propagates an explicit clear as an empty value', async () => {
            await syncNativeProxyUrl('');

            expect(invokeMock).toHaveBeenCalledWith('set_network_proxy', { proxyUrl: '' });
        });

        it('leaves the native config untouched when the setting was never configured', async () => {
            await syncNativeProxyUrl(undefined);

            expect(invokeMock).not.toHaveBeenCalled();
        });

        it('does nothing outside the Tauri runtime', async () => {
            isTauriRuntimeMock.mockReturnValue(false);

            await syncNativeProxyUrl('http://proxy.local:8080');

            expect(invokeMock).not.toHaveBeenCalled();
        });
    });
});
