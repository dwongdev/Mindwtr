import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ObsidianSourceRef } from '@mindwtr/core';

const isTauriRuntimeMock = vi.hoisted(() => vi.fn(() => false));
const invokeMock = vi.hoisted(() => vi.fn());
const listenMock = vi.hoisted(() => vi.fn());
const logWarnMock = vi.hoisted(() => vi.fn());

vi.mock('./runtime', () => ({
    isTauriRuntime: isTauriRuntimeMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: listenMock,
}));

vi.mock('./app-log', () => ({
    logWarn: logWarnMock,
}));

import { ObsidianService, formatScanFoldersInput, parseScanFoldersInput } from './obsidian-service';

const sourceRef: ObsidianSourceRef = {
    vaultName: 'My Vault',
    vaultPath: '/Vault',
    relativeFilePath: 'Projects/Alpha Plan.md',
    lineNumber: 12,
    fileModifiedAt: '2026-03-14T12:00:00.000Z',
    noteTags: [],
};

afterEach(() => {
    localStorage.clear();
    isTauriRuntimeMock.mockReset();
    isTauriRuntimeMock.mockReturnValue(false);
    invokeMock.mockReset();
    listenMock.mockReset();
    logWarnMock.mockReset();
    vi.restoreAllMocks();
});

describe('obsidian-service helpers', () => {
    it('parses scan folder input into normalized relative folders', () => {
        expect(parseScanFoldersInput('Projects\nInbox, /, ./Area/../Daily')).toEqual([
            'Projects',
            'Inbox',
            '/',
            'Daily',
        ]);
    });

    it('formats scan folders into a stable editable string', () => {
        expect(formatScanFoldersInput(['Projects', '/', 'Projects', 'Daily/Notes'])).toBe('Projects, /, Daily/Notes');
    });

    it('builds Obsidian URIs with encoded vault and file names', () => {
        expect(ObsidianService.buildObsidianUri(sourceRef)).toBe(
            'obsidian://open?vault=My%20Vault&file=Projects%2FAlpha%20Plan'
        );
    });

    it('opens obsidian URIs through the browser when not running in Tauri', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

        await ObsidianService.openTaskInObsidian(sourceRef);

        expect(openSpy).toHaveBeenCalledWith(
            'obsidian://open?vault=My%20Vault&file=Projects%2FAlpha%20Plan',
            '_blank',
            'noopener,noreferrer'
        );
    });

    it('checks the vault marker through the desktop backend in Tauri', async () => {
        isTauriRuntimeMock.mockReturnValue(true);
        invokeMock.mockResolvedValueOnce(true);

        await expect(ObsidianService.hasVaultMarker('/Vault')).resolves.toBe(true);

        expect(invokeMock).toHaveBeenCalledWith('check_obsidian_vault_marker', {
            vaultPath: '/Vault',
        });
    });

    it('treats vault marker lookup failures as unknown instead of surfacing a UI error', async () => {
        isTauriRuntimeMock.mockReturnValue(true);
        invokeMock.mockRejectedValue(new Error('forbidden'));

        await expect(ObsidianService.hasVaultMarker('/Vault')).resolves.toBeNull();
        await expect(ObsidianService.inspectVault('/Vault')).resolves.toEqual({
            hasObsidianDir: null,
        });
        expect(logWarnMock).toHaveBeenCalledTimes(2);
    });

    it('starts and stops the native Obsidian watcher in Tauri', async () => {
        isTauriRuntimeMock.mockReturnValue(true);
        const unlistenChanged = vi.fn();
        const unlistenError = vi.fn();
        listenMock
            .mockResolvedValueOnce(unlistenChanged)
            .mockResolvedValueOnce(unlistenError);
        invokeMock.mockResolvedValue(undefined);

        await ObsidianService.startWatcher({
            vaultPath: '/Vault',
            vaultName: 'Vault',
            scanFolders: ['/'],
            inboxFile: 'Mindwtr/Inbox.md',
            lastScannedAt: null,
            enabled: true,
        }, {
            onFilesChanged: vi.fn(),
            onError: vi.fn(),
        });

        expect(listenMock).toHaveBeenCalledTimes(2);
        expect(invokeMock).toHaveBeenCalledWith('start_obsidian_watcher', { vaultPath: '/Vault' });

        await ObsidianService.stopWatcher();

        expect(unlistenChanged).toHaveBeenCalledTimes(1);
        expect(unlistenError).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenLastCalledWith('stop_obsidian_watcher', undefined);
    });

    it('invokes the desktop write commands for task toggle and creation', async () => {
        isTauriRuntimeMock.mockReturnValue(true);
        invokeMock.mockResolvedValue(undefined);

        await ObsidianService.toggleTask({
            vaultPath: '/Vault',
            relativeFilePath: 'Inbox.md',
            lineNumber: 14,
            taskText: 'Follow up',
            setCompleted: true,
        });
        await ObsidianService.createTask({
            vaultPath: '/Vault',
            relativeFilePath: 'Mindwtr/Inbox.md',
            taskText: 'Capture task',
        });

        expect(invokeMock).toHaveBeenNthCalledWith(1, 'obsidian_toggle_task', {
            vaultPath: '/Vault',
            relativeFilePath: 'Inbox.md',
            lineNumber: 14,
            taskText: 'Follow up',
            setCompleted: true,
        });
        expect(invokeMock).toHaveBeenNthCalledWith(2, 'obsidian_create_task', {
            vaultPath: '/Vault',
            relativeFilePath: 'Mindwtr/Inbox.md',
            taskText: 'Capture task',
        });
    });
});
