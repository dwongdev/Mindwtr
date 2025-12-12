import { getNextScheduledAt, Task } from '@mindwtr/core';
import { useTaskStore } from '@mindwtr/core';

const notifiedAtByTask = new Map<string, string>();
let intervalId: number | null = null;

type TauriNotificationApi = {
    sendNotification: (payload: { title: string; body?: string }) => void;
    isPermissionGranted?: () => Promise<boolean>;
    requestPermission?: () => Promise<unknown>;
};

let tauriNotificationApi: TauriNotificationApi | null = null;

async function loadTauriNotificationApi(): Promise<TauriNotificationApi | null> {
    if (!(window as any).__TAURI__) return null;
    if (tauriNotificationApi) return tauriNotificationApi;
    try {
        // Optional dependency. If not installed, we fall back to Web Notifications.
        const moduleName = '@tauri-apps/plugin-notification';
        const mod = await import(/* @vite-ignore */ moduleName);
        tauriNotificationApi = mod as unknown as TauriNotificationApi;
        return tauriNotificationApi;
    } catch {
        return null;
    }
}

async function ensurePermission() {
    const tauriApi = await loadTauriNotificationApi();
    if (tauriApi?.isPermissionGranted && tauriApi?.requestPermission) {
        try {
            const granted = await tauriApi.isPermissionGranted();
            if (!granted) {
                await tauriApi.requestPermission();
            }
            return;
        } catch {
            // Ignore and fall through to web notifications.
        }
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
            await Notification.requestPermission();
        } catch {
            // ignore
        }
    }
}

function checkDueAndNotify() {
    const now = new Date();
    const { tasks } = useTaskStore.getState();

    tasks.forEach((task: Task) => {
        const next = getNextScheduledAt(task, now);
        if (!next) return;
        if (next.getTime() > now.getTime()) return;

        const key = next.toISOString();
        if (notifiedAtByTask.get(task.id) === key) return;

        if (tauriNotificationApi?.sendNotification) {
            tauriNotificationApi.sendNotification({
                title: task.title,
                body: task.description || '',
            });
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(task.title, { body: task.description || '' });
            } catch {
                // ignore
            }
        }
        notifiedAtByTask.set(task.id, key);
    });
}

export async function startDesktopNotifications() {
    await ensurePermission();
    await loadTauriNotificationApi();

    if (intervalId) clearInterval(intervalId);
    intervalId = window.setInterval(checkDueAndNotify, 60 * 1000);
    checkDueAndNotify();

    // Re-check on data changes.
    useTaskStore.subscribe(() => checkDueAndNotify());
}
