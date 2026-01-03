import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeAppDataWithStats, AppData, MergeStats, useTaskStore, webdavGetJson, webdavPutJson } from '@mindwtr/core';
import { mobileStorage } from './storage-adapter';
import { logSyncError, sanitizeLogMessage } from './app-log';
import { readSyncFile, writeSyncFile } from './storage-file';

export const SYNC_PATH_KEY = '@mindwtr_sync_path';
export const SYNC_BACKEND_KEY = '@mindwtr_sync_backend';
export const WEBDAV_URL_KEY = '@mindwtr_webdav_url';
export const WEBDAV_USERNAME_KEY = '@mindwtr_webdav_username';
export const WEBDAV_PASSWORD_KEY = '@mindwtr_webdav_password';

const DEFAULT_SYNC_TIMEOUT_MS = 30_000;

let syncInFlight: Promise<{ success: boolean; stats?: MergeStats; error?: string }> | null = null;

export async function performMobileSync(syncPathOverride?: string): Promise<{ success: boolean; stats?: MergeStats; error?: string }> {
  if (syncInFlight) {
    return syncInFlight;
  }
  syncInFlight = (async () => {
    const rawBackend = await AsyncStorage.getItem(SYNC_BACKEND_KEY);
    const backend = rawBackend === 'webdav' ? 'webdav' : 'file';

    let step = 'init';
    let syncUrl: string | undefined;
    let wroteLocal = false;
    try {
      let webdavConfig: { url: string; username: string; password: string } | null = null;
      let fileSyncPath: string | null = null;
      let incomingData: AppData | null;
      step = 'read-remote';
      if (backend === 'webdav') {
        const url = await AsyncStorage.getItem(WEBDAV_URL_KEY);
        if (!url) return { success: false, error: 'WebDAV URL not configured' };
        syncUrl = url;
        const username = (await AsyncStorage.getItem(WEBDAV_USERNAME_KEY)) || '';
        const password = (await AsyncStorage.getItem(WEBDAV_PASSWORD_KEY)) || '';
        webdavConfig = { url, username, password };
        incomingData = await webdavGetJson<AppData>(url, { username, password, timeoutMs: DEFAULT_SYNC_TIMEOUT_MS });
      } else {
        fileSyncPath = syncPathOverride || await AsyncStorage.getItem(SYNC_PATH_KEY);
        if (!fileSyncPath) {
          return { success: false, error: 'No sync file configured' };
        }
        incomingData = await readSyncFile(fileSyncPath);
        if (!incomingData) {
          incomingData = { tasks: [], projects: [], areas: [], settings: {} };
        }
      }

      const currentData = await mobileStorage.getData();
      step = 'merge';
      const mergeResult = mergeAppDataWithStats(currentData, incomingData || { tasks: [], projects: [], areas: [], settings: {} });
      const now = new Date().toISOString();
      const conflictCount = (mergeResult.stats.tasks.conflicts || 0) + (mergeResult.stats.projects.conflicts || 0);
      const nextSyncStatus = conflictCount > 0 ? 'conflict' : 'success';

      const finalData: AppData = {
        ...mergeResult.data,
        settings: {
          ...mergeResult.data.settings,
          lastSyncAt: now,
          lastSyncStatus: nextSyncStatus,
          lastSyncError: undefined,
          lastSyncStats: mergeResult.stats,
        },
      };

      step = 'write-local';
      await mobileStorage.saveData(finalData);
      wroteLocal = true;
      step = 'write-remote';
      if (backend === 'webdav') {
        if (!webdavConfig?.url) return { success: false, error: 'WebDAV URL not configured' };
        await webdavPutJson(webdavConfig.url, finalData, { username: webdavConfig.username, password: webdavConfig.password, timeoutMs: DEFAULT_SYNC_TIMEOUT_MS });
      } else {
        if (!fileSyncPath) return { success: false, error: 'No sync file configured' };
        await writeSyncFile(fileSyncPath, finalData);
      }

      step = 'refresh';
      await useTaskStore.getState().fetchData();
      return { success: true, stats: mergeResult.stats };
    } catch (error) {
      const now = new Date().toISOString();
      const logPath = await logSyncError(error, { backend, step, url: syncUrl });
      const logHint = logPath ? ` (log: ${logPath})` : '';
      const safeMessage = sanitizeLogMessage(String(error));
      try {
        if (wroteLocal) {
          await useTaskStore.getState().fetchData();
        }
        await useTaskStore.getState().updateSettings({
          lastSyncAt: now,
          lastSyncStatus: 'error',
          lastSyncError: `${safeMessage}${logHint}`,
        });
      } catch (e) {
        console.error('[Mobile] Failed to persist sync error', e);
      }

      return { success: false, error: `${safeMessage}${logHint}` };
    }
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}
