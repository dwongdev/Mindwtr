import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { CLOUD_TOKEN_KEY, WEBDAV_PASSWORD_KEY } from './sync-constants';

// Sync credentials that must live in the platform keystore (iOS Keychain /
// Android Keystore) rather than plaintext AsyncStorage, which lands in device
// backups. Non-secret sync config (URLs, usernames, flags) stays in
// AsyncStorage on purpose: SecureStore reads are slower and size-limited.
const SECRET_CONFIG_KEYS: ReadonlySet<string> = new Set([WEBDAV_PASSWORD_KEY, CLOUD_TOKEN_KEY]);

export const isSecretConfigKey = (key: string): boolean => SECRET_CONFIG_KEYS.has(key);

// SecureStore keys only allow [A-Za-z0-9._-]; strip the AsyncStorage '@' prefix.
const secureKeyFor = (key: string): string => key.replace(/^@/, '');

// AFTER_FIRST_UNLOCK (not WHEN_UNLOCKED): background sync can fire while the
// device is locked, and these credentials must stay readable there.
const SECURE_WRITE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const secureAvailable = (() => {
    let cached: Promise<boolean> | null = null;
    return () => {
        if (!cached) {
            cached = SecureStore.isAvailableAsync().catch(() => false);
        }
        return cached;
    };
})();

const migrateLegacyValue = async (key: string, legacyValue: string): Promise<void> => {
    try {
        await SecureStore.setItemAsync(secureKeyFor(key), legacyValue, SECURE_WRITE_OPTIONS);
        await AsyncStorage.removeItem(key);
    } catch {
        // Keep the AsyncStorage copy until a secure write succeeds; the next
        // read retries the migration.
    }
};

export const getSecureConfigValue = async (key: string): Promise<string | null> => {
    if (await secureAvailable()) {
        try {
            const secureValue = await SecureStore.getItemAsync(secureKeyFor(key));
            if (secureValue !== null) return secureValue;
        } catch {
            // Fall through to the legacy value rather than dropping credentials.
        }
        const legacyValue = await AsyncStorage.getItem(key);
        if (legacyValue !== null) {
            await migrateLegacyValue(key, legacyValue);
        }
        return legacyValue;
    }
    return AsyncStorage.getItem(key);
};

export const setSecureConfigValue = async (key: string, value: string): Promise<void> => {
    if (await secureAvailable()) {
        await SecureStore.setItemAsync(secureKeyFor(key), value, SECURE_WRITE_OPTIONS);
        await AsyncStorage.removeItem(key);
        return;
    }
    await AsyncStorage.setItem(key, value);
};

export const deleteSecureConfigValue = async (key: string): Promise<void> => {
    if (await secureAvailable()) {
        try {
            await SecureStore.deleteItemAsync(secureKeyFor(key));
        } catch {
            // Best effort; the AsyncStorage removal below still runs.
        }
    }
    await AsyncStorage.removeItem(key);
};
