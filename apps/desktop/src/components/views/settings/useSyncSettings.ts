import { useCallback, useEffect, useState } from 'react';
import { SyncService } from '../../../lib/sync-service';
import { useUiStore } from '../../../store/ui-store';
import { logError } from '../../../lib/app-log';

export type SyncBackend = 'off' | 'file' | 'webdav' | 'cloud';

type UseSyncSettingsOptions = {
    isTauri: boolean;
    showSaved: () => void;
    selectSyncFolderTitle: string;
};

export const useSyncSettings = ({ isTauri, showSaved, selectSyncFolderTitle }: UseSyncSettingsOptions) => {
    const [syncPath, setSyncPath] = useState('');
    const [syncStatus, setSyncStatus] = useState(() => SyncService.getSyncStatus());
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncBackend, setSyncBackend] = useState<SyncBackend>('off');
    const [webdavUrl, setWebdavUrl] = useState('');
    const [webdavUsername, setWebdavUsername] = useState('');
    const [webdavPassword, setWebdavPassword] = useState('');
    const [webdavHasPassword, setWebdavHasPassword] = useState(false);
    const [isSavingWebDav, setIsSavingWebDav] = useState(false);
    const [cloudUrl, setCloudUrl] = useState('');
    const [cloudToken, setCloudToken] = useState('');
    const [snapshots, setSnapshots] = useState<string[]>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
    const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);
    const showToast = useUiStore((state) => state.showToast);

    const formatSyncPathError = useCallback((message?: string): string => {
        const normalized = (message || '').toLowerCase();
        if (normalized.includes('must be a directory')) {
            return 'Select a folder for sync, not a backup JSON file.';
        }
        if (normalized.includes('permission denied') || normalized.includes('operation not permitted')) {
            return 'Mindwtr cannot access this folder. Choose a folder you own, then try again.';
        }
        return message || 'Failed to save sync folder.';
    }, []);

    useEffect(() => {
        const unsubscribe = SyncService.subscribeSyncStatus(setSyncStatus);
        const loadSnapshots = async () => {
            if (!isTauri) return;
            setIsLoadingSnapshots(true);
            try {
                setSnapshots(await SyncService.listDataSnapshots());
            } finally {
                setIsLoadingSnapshots(false);
            }
        };
        SyncService.getSyncPath()
            .then(setSyncPath)
            .catch((error) => {
                setSyncError('Failed to load sync path.');
                void logError(error, { scope: 'sync', step: 'loadPath' });
            });
        SyncService.getSyncBackend()
            .then(setSyncBackend)
            .catch((error) => {
                setSyncError('Failed to load sync backend.');
                void logError(error, { scope: 'sync', step: 'loadBackend' });
            });
        SyncService.getWebDavConfig({ silent: true })
            .then((cfg) => {
                setWebdavUrl(cfg.url);
                setWebdavUsername(cfg.username);
                setWebdavPassword(cfg.password ?? '');
                setWebdavHasPassword(cfg.hasPassword === true);
            })
            .catch((error) => {
                setSyncError('Failed to load WebDAV config.');
                void logError(error, { scope: 'sync', step: 'loadWebDav' });
            });
        SyncService.getCloudConfig({ silent: true })
            .then((cfg) => {
                setCloudUrl(cfg.url);
                setCloudToken(cfg.token);
            })
            .catch((error) => {
                setSyncError('Failed to load Cloud config.');
                void logError(error, { scope: 'sync', step: 'loadCloud' });
            });
        loadSnapshots().catch((error) => {
            void logError(error, { scope: 'sync', step: 'loadSnapshots' });
        });
        return unsubscribe;
    }, [isTauri]);

    const handleSaveSyncPath = useCallback(async () => {
        if (!syncPath.trim()) return;
        const result = await SyncService.setSyncPath(syncPath.trim());
        if (result.success) {
            setSyncError(null);
            showSaved();
            return;
        }
        const message = formatSyncPathError(result.error);
        setSyncError(message);
        showToast(message, 'error');
    }, [formatSyncPathError, showSaved, showToast, syncPath]);

    const handleChangeSyncLocation = useCallback(async () => {
        try {
            if (!isTauri) return;

            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                directory: true,
                multiple: false,
                title: selectSyncFolderTitle,
            });

            if (selected && typeof selected === 'string') {
                setSyncPath(selected);
                const result = await SyncService.setSyncPath(selected);
                if (result.success) {
                    setSyncError(null);
                    showSaved();
                    return;
                }
                const message = formatSyncPathError(result.error);
                setSyncError(message);
                showToast(message, 'error');
            }
        } catch (error) {
            setSyncError('Failed to change sync location.');
            void logError(error, { scope: 'sync', step: 'changeLocation' });
        }
    }, [formatSyncPathError, isTauri, selectSyncFolderTitle, showSaved, showToast]);

    const handleSetSyncBackend = useCallback(async (backend: SyncBackend) => {
        setSyncBackend(backend);
        await SyncService.setSyncBackend(backend);
        showSaved();
    }, [showSaved]);

    const handleSaveWebDav = useCallback(async () => {
        const trimmedUrl = webdavUrl.trim();
        const trimmedPassword = webdavPassword.trim();
        setIsSavingWebDav(true);
        try {
            await SyncService.setWebDavConfig({
                url: trimmedUrl,
                username: webdavUsername.trim(),
                ...(trimmedPassword ? { password: trimmedPassword } : {}),
            });
            if (!trimmedUrl) {
                setWebdavHasPassword(false);
                setWebdavPassword('');
            } else if (trimmedPassword) {
                setWebdavHasPassword(true);
            }
            showSaved();
        } finally {
            setIsSavingWebDav(false);
        }
    }, [showSaved, webdavPassword, webdavUrl, webdavUsername]);

    const handleSaveCloud = useCallback(async () => {
        await SyncService.setCloudConfig({
            url: cloudUrl.trim(),
            token: cloudToken.trim(),
        });
        showSaved();
    }, [cloudUrl, cloudToken, showSaved]);

    const handleSync = useCallback(async () => {
        try {
            setSyncError(null);

            if (syncBackend === 'off') {
                return;
            }
            if (syncBackend === 'webdav') {
                if (!webdavUrl.trim()) return;
                await handleSaveWebDav();
            }
            if (syncBackend === 'cloud') {
                if (!cloudUrl.trim()) return;
                await handleSaveCloud();
            }
            if (syncBackend === 'file') {
                const path = syncPath.trim();
                if (path) {
                    const setPathResult = await SyncService.setSyncPath(path);
                    if (!setPathResult.success) {
                        const message = formatSyncPathError(setPathResult.error);
                        setSyncError(message);
                        showToast(message, 'error');
                        return;
                    }
                }
            }

            const result = await SyncService.performSync();
            if (result.success) {
                showToast('Sync completed', 'success');
                if (isTauri) {
                    setSnapshots(await SyncService.listDataSnapshots());
                }
            } else if (result.error) {
                showToast(result.error, 'error');
            }
        } catch (error) {
            void logError(error, { scope: 'sync', step: 'perform' });
            setSyncError(String(error));
            showToast(String(error), 'error');
        }
    }, [cloudUrl, formatSyncPathError, handleSaveCloud, handleSaveWebDav, isTauri, showToast, syncBackend, syncPath, webdavUrl]);

    const handleRestoreSnapshot = useCallback(async (snapshotFileName: string) => {
        if (!snapshotFileName) return false;
        setIsRestoringSnapshot(true);
        try {
            const result = await SyncService.restoreDataSnapshot(snapshotFileName);
            if (!result.success) {
                showToast(result.error || 'Failed to restore snapshot.', 'error');
                return false;
            }
            showToast('Snapshot restored.', 'success');
            setSnapshots(await SyncService.listDataSnapshots());
            return true;
        } finally {
            setIsRestoringSnapshot(false);
        }
    }, [showToast]);

    return {
        syncPath,
        setSyncPath,
        isSyncing: syncStatus.inFlight,
        syncQueued: syncStatus.queued,
        syncLastResult: syncStatus.lastResult,
        syncLastResultAt: syncStatus.lastResultAt,
        syncError,
        syncBackend,
        setSyncBackend,
        webdavUrl,
        setWebdavUrl,
        webdavUsername,
        setWebdavUsername,
        webdavPassword,
        setWebdavPassword,
        webdavHasPassword,
        isSavingWebDav,
        cloudUrl,
        setCloudUrl,
        cloudToken,
        setCloudToken,
        snapshots,
        isLoadingSnapshots,
        isRestoringSnapshot,
        handleSaveSyncPath,
        handleChangeSyncLocation,
        handleSetSyncBackend,
        handleSaveWebDav,
        handleSaveCloud,
        handleSync,
        handleRestoreSnapshot,
    };
};
