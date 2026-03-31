import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckSquare2, ExternalLink, Loader2, Plus, RefreshCw, Settings, Square, Tags } from 'lucide-react';

import { safeFormatDate } from '@mindwtr/core';

import { ObsidianService } from '../../lib/obsidian-service';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/language-context';
import { useObsidianStore } from '../../store/obsidian-store';
import { useUiStore } from '../../store/ui-store';

const navigateToSettings = () => {
    window.dispatchEvent(new CustomEvent('mindwtr:navigate', { detail: { view: 'settings' } }));
};

const pageShellClassName = 'h-full px-4 py-3';
const pageContentClassName = 'mx-auto w-full max-w-[84rem] min-w-0 2xl:max-w-[88rem]';

export function ObsidianView() {
    const { t } = useLanguage();
    const showToast = useUiStore((state) => state.showToast);
    const config = useObsidianStore((state) => state.config);
    const tasks = useObsidianStore((state) => state.tasks);
    const scannedFileCount = useObsidianStore((state) => state.scannedFileCount);
    const hasScannedThisSession = useObsidianStore((state) => state.hasScannedThisSession);
    const isInitialized = useObsidianStore((state) => state.isInitialized);
    const isLoadingConfig = useObsidianStore((state) => state.isLoadingConfig);
    const isScanning = useObsidianStore((state) => state.isScanning);
    const isWatching = useObsidianStore((state) => state.isWatching);
    const error = useObsidianStore((state) => state.error);
    const watcherError = useObsidianStore((state) => state.watcherError);
    const loadConfig = useObsidianStore((state) => state.loadConfig);
    const rescan = useObsidianStore((state) => state.rescan);
    const clearError = useObsidianStore((state) => state.clearError);
    const [newTaskText, setNewTaskText] = useState('');
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [pendingTaskIds, setPendingTaskIds] = useState<Record<string, true>>({});

    const resolveText = useCallback((key: string, fallback: string) => {
        const value = t(key);
        return value === key ? fallback : value;
    }, [t]);

    useEffect(() => {
        if (isInitialized) return;
        loadConfig().catch((scanError) => {
            showToast(String(scanError), 'error');
        });
    }, [isInitialized, loadConfig, showToast]);

    useEffect(() => {
        if (!isInitialized || isLoadingConfig || isScanning) return;
        if (!config.enabled || !config.vaultPath || hasScannedThisSession) return;
        rescan().catch((scanError) => {
            showToast(String(scanError), 'error');
        });
    }, [
        config.enabled,
        config.vaultPath,
        hasScannedThisSession,
        isInitialized,
        isLoadingConfig,
        isScanning,
        rescan,
        showToast,
    ]);

    useEffect(() => {
        if (!error) return;
        showToast(error, 'error', 5000);
        clearError();
    }, [clearError, error, showToast]);

    const handleRescan = useCallback(async () => {
        await rescan();
        const { error: nextError, warnings } = useObsidianStore.getState();
        if (nextError) {
            showToast(nextError, 'error', 5000);
            clearError();
            return;
        }
        if (warnings.length > 0) {
            showToast(warnings[0], 'info', 6000);
            return;
        }
        showToast(resolveText('obsidian.scanSuccess', 'Obsidian vault scanned.'), 'success');
    }, [clearError, resolveText, rescan, showToast]);

    const handleOpenTask = useCallback(async (taskSource: Parameters<typeof ObsidianService.openTaskInObsidian>[0]) => {
        try {
            await ObsidianService.openTaskInObsidian(taskSource);
        } catch (openError) {
            showToast(
                openError instanceof Error && openError.message.trim()
                    ? openError.message
                    : resolveText('obsidian.openFailed', 'Failed to open note in Obsidian.'),
                'error',
                5000
            );
        }
    }, [resolveText, showToast]);

    const handleToggleTask = useCallback(async (task: typeof tasks[number]) => {
        if (!config.vaultPath) return;
        setPendingTaskIds((current) => ({ ...current, [task.id]: true }));
        try {
            await ObsidianService.toggleTask({
                vaultPath: config.vaultPath,
                relativeFilePath: task.source.relativeFilePath,
                lineNumber: task.source.lineNumber,
                taskText: task.text,
                setCompleted: !task.completed,
            });
            if (!isWatching) {
                await rescan();
            }
        } catch (toggleError) {
            showToast(
                toggleError instanceof Error && toggleError.message.trim()
                    ? toggleError.message
                    : resolveText('obsidian.toggleFailed', 'Could not update the task in Obsidian. Try rescanning the vault.'),
                'error',
                5000
            );
        } finally {
            setPendingTaskIds((current) => {
                const next = { ...current };
                delete next[task.id];
                return next;
            });
        }
    }, [config.vaultPath, isWatching, rescan, resolveText, showToast]);

    const handleCreateTask = useCallback(async () => {
        const trimmed = newTaskText.trim();
        if (!trimmed || !config.vaultPath) return;
        setIsCreatingTask(true);
        try {
            await ObsidianService.createTask({
                vaultPath: config.vaultPath,
                relativeFilePath: config.inboxFile,
                taskText: trimmed,
            });
            setNewTaskText('');
            if (!isWatching) {
                await rescan();
            }
        } catch (createError) {
            showToast(
                createError instanceof Error && createError.message.trim()
                    ? createError.message
                    : resolveText('obsidian.createFailed', 'Could not create the task in Obsidian.'),
                'error',
                5000
            );
        } finally {
            setIsCreatingTask(false);
        }
    }, [config.inboxFile, config.vaultPath, isWatching, newTaskText, rescan, resolveText, showToast]);

    if (!isInitialized || isLoadingConfig) {
        return (
            <div className={pageShellClassName}>
                <div className={cn(pageContentClassName, 'rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground')}>
                    {resolveText('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    const hasVault = Boolean(config.vaultPath);
    const canScan = Boolean(config.vaultPath && config.enabled);
    const hasCompletedScan = hasScannedThisSession || Boolean(config.lastScannedAt);

    return (
        <div className={pageShellClassName}>
            <div className={cn(pageContentClassName, 'space-y-6')}>
                <section className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                                <BookOpen className="h-3.5 w-3.5" />
                                {resolveText('nav.obsidian', 'Obsidian')}
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-3xl font-semibold tracking-tight">
                                    {resolveText('obsidian.title', 'Vault Tasks')}
                                </h1>
                                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                    {resolveText(
                                        'obsidian.description',
                                        'Read tasks from your Obsidian vault, keep the source note visible, and jump back into Obsidian when you need more context.'
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="rounded-full bg-muted px-3 py-1.5">
                                    {resolveText('obsidian.notesCount', 'Notes scanned')}: {scannedFileCount}
                                </span>
                                <span className="rounded-full bg-muted px-3 py-1.5">
                                    {resolveText('obsidian.tasksCount', 'Imported tasks')}: {tasks.length}
                                </span>
                                <span className="rounded-full bg-muted px-3 py-1.5">
                                    {resolveText('obsidian.lastScanned', 'Last scanned')}:{' '}
                                    {config.lastScannedAt
                                        ? safeFormatDate(config.lastScannedAt, 'PPpp', config.lastScannedAt)
                                        : resolveText('obsidian.neverScanned', 'Never')}
                                </span>
                                {canScan && (
                                    <span
                                        className={cn(
                                            'rounded-full px-3 py-1.5',
                                            watcherError
                                                ? 'bg-amber-100 text-amber-800'
                                                : isWatching
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-muted'
                                        )}
                                    >
                                        {watcherError
                                            ? resolveText('obsidian.liveUpdatesUnavailable', 'Live updates unavailable')
                                            : isWatching
                                                ? resolveText('obsidian.watching', 'Watching for changes')
                                                : resolveText('obsidian.manualRefreshOnly', 'Manual refresh only')}
                                    </span>
                                )}
                            </div>
                            {hasVault && (
                                <p className="text-xs text-muted-foreground">
                                    {resolveText('obsidian.vaultPath', 'Vault')}: <span className="font-mono">{config.vaultPath}</span>
                                </p>
                            )}
                            {watcherError && (
                                <p className="text-xs text-amber-700">{watcherError}</p>
                            )}
                        </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={navigateToSettings}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                        >
                            <Settings className="h-4 w-4" />
                            {resolveText('nav.settings', 'Settings')}
                        </button>
                        <button
                            type="button"
                            onClick={handleRescan}
                            disabled={!canScan || isScanning}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                                canScan && !isScanning
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'bg-muted text-muted-foreground'
                            )}
                        >
                            <RefreshCw className={cn('h-4 w-4', isScanning && 'animate-spin')} />
                            {isScanning
                                ? resolveText('obsidian.rescanning', 'Scanning...')
                                : resolveText('obsidian.rescan', 'Rescan vault')}
                        </button>
                    </div>
                    </div>
                </section>

                {canScan && (
                    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="min-w-0 flex-1">
                                <label htmlFor="obsidian-add-task" className="text-sm font-medium">
                                    {resolveText('obsidian.addTask', 'Add task to Obsidian')}
                                </label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {resolveText('obsidian.addTaskHint', 'Writes to')} <span className="font-mono">{config.inboxFile}</span>
                                </p>
                            </div>
                            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                                <input
                                    id="obsidian-add-task"
                                    type="text"
                                    value={newTaskText}
                                    onChange={(event) => setNewTaskText(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            void handleCreateTask();
                                        }
                                    }}
                                    placeholder={resolveText('obsidian.addTaskPlaceholder', 'Capture a task into your Obsidian inbox note...')}
                                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateTask}
                                    disabled={isCreatingTask || !newTaskText.trim()}
                                    className={cn(
                                        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                                        !isCreatingTask && newTaskText.trim()
                                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    {isCreatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    {isCreatingTask
                                        ? resolveText('common.saving', 'Saving...')
                                        : resolveText('obsidian.addTaskAction', 'Add task')}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {!hasVault && (
                    <section className="rounded-2xl border border-dashed border-border bg-card p-8">
                        <h2 className="text-lg font-semibold">{resolveText('obsidian.setupTitle', 'Set up an Obsidian vault')}</h2>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            {resolveText(
                                'obsidian.setupBody',
                                'Choose your vault folder in Settings -> Integrations -> Obsidian Vault, then enable the integration and rescan.'
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={navigateToSettings}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            <Settings className="h-4 w-4" />
                            {resolveText('obsidian.openSettings', 'Open settings')}
                        </button>
                    </section>
                )}

                {hasVault && !config.enabled && (
                    <section className="rounded-2xl border border-border bg-card p-8">
                        <h2 className="text-lg font-semibold">{resolveText('obsidian.disabledTitle', 'Enable the integration')}</h2>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            {resolveText(
                                'obsidian.disabledBody',
                                'A vault is configured, but the integration is turned off. Enable it in Settings before scanning.'
                            )}
                        </p>
                    </section>
                )}

                {canScan && tasks.length === 0 && hasCompletedScan && !isScanning && (
                    <section className="rounded-2xl border border-border bg-card p-8">
                        <h2 className="text-lg font-semibold">{resolveText('obsidian.emptyTitle', 'No tasks found')}</h2>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            {resolveText(
                                'obsidian.emptyBody',
                                'Mindwtr scanned the configured folders but did not find any Markdown checklist items yet.'
                            )}
                        </p>
                    </section>
                )}

                {tasks.length > 0 && (
                    <section className="space-y-3">
                        {tasks.map((task) => {
                            const isPending = Boolean(pendingTaskIds[task.id]);
                            return (
                                <article
                                    key={task.id}
                                    className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
                                >
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0 space-y-3">
                                            <div className="flex items-start gap-3">
                                                {isPending ? (
                                                    <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
                                                ) : task.completed ? (
                                                    <CheckSquare2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                                                ) : (
                                                    <Square className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className={cn(
                                                        'text-sm leading-6 text-foreground',
                                                        task.completed && 'text-muted-foreground line-through'
                                                    )}>
                                                        {task.text}
                                                    </p>
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        {task.source.relativeFilePath}:{task.source.lineNumber}
                                                    </p>
                                                </div>
                                            </div>
                                            {(task.tags.length > 0 || task.wikiLinks.length > 0) && (
                                                <div className="flex flex-wrap gap-2 pl-8">
                                                    {task.tags.map((tag) => (
                                                        <span
                                                            key={`${task.id}-tag-${tag}`}
                                                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                                                        >
                                                            <Tags className="h-3 w-3" />#{tag}
                                                        </span>
                                                    ))}
                                                    {task.wikiLinks.map((link) => (
                                                        <span
                                                            key={`${task.id}-link-${link}`}
                                                            className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground"
                                                        >
                                                            [[{link}]]
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleToggleTask(task)}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : task.completed ? (
                                                    <Square className="h-4 w-4" />
                                                ) : (
                                                    <CheckSquare2 className="h-4 w-4" />
                                                )}
                                                {isPending
                                                    ? resolveText('common.saving', 'Saving...')
                                                    : task.completed
                                                        ? resolveText('obsidian.markIncomplete', 'Mark incomplete')
                                                        : resolveText('obsidian.markComplete', 'Mark complete')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTask(task.source)}
                                                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                {resolveText('obsidian.openTask', 'Open in Obsidian')}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </div>
    );
}
