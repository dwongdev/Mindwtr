import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetItem = vi.hoisted(() => vi.fn());
const mockSetItem = vi.hoisted(() => vi.fn());
const mockRemoveItem = vi.hoisted(() => vi.fn());
const mockShow = vi.hoisted(() => vi.fn());
const mockHide = vi.hoisted(() => vi.fn());
const mockPermissionCheck = vi.hoisted(() => vi.fn());
const platformState = vi.hoisted(() => ({ OS: 'android', Version: 34 }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: mockRemoveItem,
    },
}));

vi.mock('react-native', () => ({
    Platform: platformState,
    PermissionsAndroid: {
        check: mockPermissionCheck,
        PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    },
}));

vi.mock('@/modules/notification-open-intents', () => ({
    showPersistentCaptureNotification: mockShow,
    hidePersistentCaptureNotification: mockHide,
}));

import {
    applyPersistentCaptureNotification,
    readPersistentCaptureEnabled,
    restorePersistentCaptureNotificationOnStartup,
    writePersistentCaptureEnabled,
} from './persistent-capture-notification';

const strings = { title: 'Quick add', text: 'Tap to capture', channelName: 'Quick capture' };

describe('persistent-capture-notification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        platformState.OS = 'android';
        platformState.Version = 34;
        mockPermissionCheck.mockResolvedValue(true);
        mockGetItem.mockResolvedValue(null);
    });

    it('round-trips the device-local preference', async () => {
        await writePersistentCaptureEnabled(true);
        expect(mockSetItem).toHaveBeenCalledWith('mindwtr:persistentCaptureNotification', 'true');

        mockGetItem.mockResolvedValue('true');
        expect(await readPersistentCaptureEnabled()).toBe(true);

        await writePersistentCaptureEnabled(false);
        expect(mockRemoveItem).toHaveBeenCalledWith('mindwtr:persistentCaptureNotification');
    });

    it('shows and hides the notification to match the toggle', () => {
        applyPersistentCaptureNotification(true, strings);
        expect(mockShow).toHaveBeenCalledWith('Quick add', 'Tap to capture', 'Quick capture');

        applyPersistentCaptureNotification(false, strings);
        expect(mockHide).toHaveBeenCalled();
    });

    it('re-posts on startup only when enabled and permitted', async () => {
        mockGetItem.mockResolvedValue('true');
        await restorePersistentCaptureNotificationOnStartup(strings);
        expect(mockShow).toHaveBeenCalledTimes(1);

        mockShow.mockClear();
        mockGetItem.mockResolvedValue(null);
        await restorePersistentCaptureNotificationOnStartup(strings);
        expect(mockShow).not.toHaveBeenCalled();

        mockGetItem.mockResolvedValue('true');
        mockPermissionCheck.mockResolvedValue(false);
        await restorePersistentCaptureNotificationOnStartup(strings);
        expect(mockShow).not.toHaveBeenCalled();
    });

    it('is inert off Android', async () => {
        platformState.OS = 'ios';
        await writePersistentCaptureEnabled(true);
        applyPersistentCaptureNotification(true, strings);
        await restorePersistentCaptureNotificationOnStartup(strings);
        expect(mockSetItem).not.toHaveBeenCalled();
        expect(mockShow).not.toHaveBeenCalled();
        expect(await readPersistentCaptureEnabled()).toBe(false);
    });
});
