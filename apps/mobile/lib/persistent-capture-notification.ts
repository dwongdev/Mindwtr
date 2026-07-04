import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

import {
    hidePersistentCaptureNotification,
    showPersistentCaptureNotification,
} from '@/modules/notification-open-intents';

// Device-local preference (P14): a notification pinned to this device's status
// bar is per-device UX state and must not enter the synced settings document.
const STORAGE_KEY = 'mindwtr:persistentCaptureNotification';

export type PersistentCaptureStrings = {
    title: string;
    text: string;
    channelName: string;
};

export function isPersistentCaptureSupported(): boolean {
    return Platform.OS === 'android';
}

export async function readPersistentCaptureEnabled(): Promise<boolean> {
    if (!isPersistentCaptureSupported()) return false;
    try {
        return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
    } catch {
        return false;
    }
}

export async function writePersistentCaptureEnabled(enabled: boolean): Promise<void> {
    if (!isPersistentCaptureSupported()) return;
    try {
        if (enabled) {
            await AsyncStorage.setItem(STORAGE_KEY, 'true');
        } else {
            await AsyncStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // storage unavailable — the toggle simply won't persist across restarts
    }
}

async function hasNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (Platform.Version < 33) return true;
    try {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch {
        return false;
    }
}

/** Post or remove the notification to match `enabled`. */
export function applyPersistentCaptureNotification(enabled: boolean, strings: PersistentCaptureStrings): void {
    if (!isPersistentCaptureSupported()) return;
    if (enabled) {
        showPersistentCaptureNotification(strings.title, strings.text, strings.channelName);
    } else {
        hidePersistentCaptureNotification();
    }
}

/**
 * Re-post the notification on app start when the preference is on — Android
 * drops notifications on reboot and there is deliberately no boot receiver in
 * v1, so the app re-arms it the next time it runs. Permission is only checked
 * here, never requested; prompting belongs to the settings toggle.
 */
export async function restorePersistentCaptureNotificationOnStartup(strings: PersistentCaptureStrings): Promise<void> {
    if (!isPersistentCaptureSupported()) return;
    const enabled = await readPersistentCaptureEnabled();
    if (!enabled) return;
    if (!(await hasNotificationPermission())) return;
    applyPersistentCaptureNotification(true, strings);
}
