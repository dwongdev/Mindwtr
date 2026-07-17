import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeMocks = vi.hoisted(() => ({
    secureAvailable: true,
    secureItems: new Map<string, string>(),
    asyncItems: new Map<string, string>(),
    failSecureWrites: false,
    setItemAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
    isAvailableAsync: vi.fn(async () => storeMocks.secureAvailable),
    getItemAsync: vi.fn(async (key: string) => storeMocks.secureItems.get(key) ?? null),
    setItemAsync: storeMocks.setItemAsync.mockImplementation(async (key: string, value: string) => {
        if (storeMocks.failSecureWrites) throw new Error('keystore unavailable');
        storeMocks.secureItems.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
        storeMocks.secureItems.delete(key);
    }),
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(async (key: string) => storeMocks.asyncItems.get(key) ?? null),
        setItem: vi.fn(async (key: string, value: string) => {
            storeMocks.asyncItems.set(key, value);
        }),
        removeItem: vi.fn(async (key: string) => {
            storeMocks.asyncItems.delete(key);
        }),
    },
}));

import { CLOUD_TOKEN_KEY, WEBDAV_PASSWORD_KEY } from './sync-constants';
import {
    deleteSecureConfigValue,
    getSecureConfigValue,
    isSecretConfigKey,
    setSecureConfigValue,
} from './secure-config';

// The module caches isAvailableAsync for its lifetime, so this suite keeps
// secureAvailable=true throughout and covers the unavailable path via the
// migration-failure case instead.
describe('secure-config', () => {
    beforeEach(() => {
        storeMocks.secureItems.clear();
        storeMocks.asyncItems.clear();
        storeMocks.failSecureWrites = false;
        storeMocks.setItemAsync.mockClear();
    });

    it('flags only the cloud token and WebDAV password as secrets', () => {
        expect(isSecretConfigKey(CLOUD_TOKEN_KEY)).toBe(true);
        expect(isSecretConfigKey(WEBDAV_PASSWORD_KEY)).toBe(true);
        expect(isSecretConfigKey('@mindwtr_cloud_url')).toBe(false);
    });

    it('writes secrets to the secure store and scrubs the plaintext copy', async () => {
        storeMocks.asyncItems.set(CLOUD_TOKEN_KEY, 'old-plaintext');

        await setSecureConfigValue(CLOUD_TOKEN_KEY, 'fresh-token');

        expect(storeMocks.secureItems.get('mindwtr_cloud_token')).toBe('fresh-token');
        expect(storeMocks.asyncItems.has(CLOUD_TOKEN_KEY)).toBe(false);
        expect(storeMocks.setItemAsync).toHaveBeenCalledWith(
            'mindwtr_cloud_token',
            'fresh-token',
            { keychainAccessible: 'afterFirstUnlockThisDeviceOnly' },
        );
    });

    it('reads from the secure store first', async () => {
        storeMocks.secureItems.set('mindwtr_webdav_password', 'secure-pass');
        storeMocks.asyncItems.set(WEBDAV_PASSWORD_KEY, 'stale-plaintext');

        await expect(getSecureConfigValue(WEBDAV_PASSWORD_KEY)).resolves.toBe('secure-pass');
    });

    it('migrates a legacy plaintext value into the secure store on read', async () => {
        storeMocks.asyncItems.set(CLOUD_TOKEN_KEY, 'legacy-token');

        await expect(getSecureConfigValue(CLOUD_TOKEN_KEY)).resolves.toBe('legacy-token');
        expect(storeMocks.secureItems.get('mindwtr_cloud_token')).toBe('legacy-token');
        expect(storeMocks.asyncItems.has(CLOUD_TOKEN_KEY)).toBe(false);
    });

    it('keeps the plaintext copy when the secure write fails, so credentials are not lost', async () => {
        storeMocks.asyncItems.set(CLOUD_TOKEN_KEY, 'legacy-token');
        storeMocks.failSecureWrites = true;

        await expect(getSecureConfigValue(CLOUD_TOKEN_KEY)).resolves.toBe('legacy-token');
        expect(storeMocks.asyncItems.get(CLOUD_TOKEN_KEY)).toBe('legacy-token');
    });

    it('returns null when neither store has a value', async () => {
        await expect(getSecureConfigValue(WEBDAV_PASSWORD_KEY)).resolves.toBeNull();
    });

    it('deletes from both stores', async () => {
        storeMocks.secureItems.set('mindwtr_webdav_password', 'secure-pass');
        storeMocks.asyncItems.set(WEBDAV_PASSWORD_KEY, 'stale-plaintext');

        await deleteSecureConfigValue(WEBDAV_PASSWORD_KEY);

        expect(storeMocks.secureItems.has('mindwtr_webdav_password')).toBe(false);
        expect(storeMocks.asyncItems.has(WEBDAV_PASSWORD_KEY)).toBe(false);
    });
});
