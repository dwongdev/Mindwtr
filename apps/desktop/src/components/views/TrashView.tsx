import { useMemo, useState, useEffect } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { buildTrashTimeline, shallow, useTaskStore, safeFormatDate } from '@mindwtr/core';
import type { Project } from '@mindwtr/core';
import { Undo2, Trash2 } from 'lucide-react';
import { useLanguage } from '../../contexts/language-context';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { checkBudget } from '../../config/performanceBudgets';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

export function TrashView() {
    const perf = usePerformanceMonitor('TrashView');
    const {
        _allTasks,
        _allProjects,
        restoreTask,
        restoreProject,
        purgeTask,
        purgeProject,
        purgeDeletedTasks,
        purgeDeletedProjects,
    } = useTaskStore(
        (state) => ({
            _allTasks: state._allTasks,
            _allProjects: state._allProjects,
            restoreTask: state.restoreTask,
            restoreProject: state.restoreProject,
            purgeTask: state.purgeTask,
            purgeProject: state.purgeProject,
            purgeDeletedTasks: state.purgeDeletedTasks,
            purgeDeletedProjects: state.purgeDeletedProjects,
        }),
        shallow
    );
    const { t } = useLanguage();
    const { requestConfirmation, confirmModal } = useConfirmDialog();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!perf.enabled) return;
        const timer = window.setTimeout(() => {
            checkBudget('TrashView', perf.metrics, 'simple');
        }, 0);
        return () => window.clearTimeout(timer);
    }, [perf.enabled]);

    const trashedTasks = useMemo(() => {
        const filtered = _allTasks.filter((task) => task.deletedAt && !task.purgedAt);
        if (!searchQuery) return filtered;
        const query = searchQuery.toLowerCase();
        return filtered.filter((task) => task.title.toLowerCase().includes(query));
    }, [_allTasks, searchQuery]);

    const trashedProjects = useMemo(() => {
        const filtered = _allProjects.filter((project) => project.deletedAt && !project.purgedAt);
        if (!searchQuery) return filtered;
        const query = searchQuery.toLowerCase();
        return filtered.filter((project) => project.title.toLowerCase().includes(query));
    }, [_allProjects, searchQuery]);

    const trashItems = useMemo(
        () => buildTrashTimeline(trashedTasks, trashedProjects),
        [trashedProjects, trashedTasks]
    );

    const trashedItemCount = trashItems.length;

    const handleClearTrash = async () => {
        if (trashedItemCount === 0) return;
        const confirmed = await requestConfirmation({
            title: t('trash.clearAllConfirm'),
            description: trashedProjects.length > 0
                ? t('trash.clearAllConfirmBodyWithProjects')
                : t('trash.clearAllConfirmBody'),
            confirmLabel: t('trash.clearAll'),
            cancelLabel: t('common.cancel') || 'Cancel',
        });
        if (!confirmed) return;
        await Promise.all([purgeDeletedTasks(), purgeDeletedProjects()]);
    };

    const handlePurgeTask = async (taskId: string) => {
        const task = _allTasks.find((item) => item.id === taskId);
        if (!task) return;
        const confirmed = await requestConfirmation({
            title: task.title,
            description: t('trash.deleteConfirmBody'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel') || 'Cancel',
        });
        if (!confirmed) return;
        purgeTask(taskId);
    };

    const handlePurgeProject = async (project: Project) => {
        const confirmed = await requestConfirmation({
            title: project.title,
            description: t('trash.deleteConfirmBody'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel') || 'Cancel',
        });
        if (!confirmed) return;
        purgeProject(project.id);
    };

    const renderDeletedAt = (deletedAt?: string) => (
        deletedAt ? [t('trash.deletedAt'), safeFormatDate(deletedAt, 'P')].join(': ') : null
    );

    return (
        <ErrorBoundary>
            <div className="space-y-6">
            <header className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">{t('trash.title')}</h2>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                        {trashedTasks.length} {t('common.tasks')} · {trashedProjects.length} {t('projects.title')}
                    </div>
                    <button
                        onClick={handleClearTrash}
                        disabled={trashedItemCount === 0}
                        className="text-xs px-3 py-1 rounded-md border transition-colors bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('trash.clearAll')}
                    </button>
                </div>
            </header>

            <div className="relative">
                <input
                    type="text"
                    placeholder={t('trash.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg py-2 pl-4 pr-4 shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
            </div>

            <div className="space-y-6">
                {trashedItemCount === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                        <p>{t('trash.noTasksFound')}</p>
                        <p className="text-xs mt-2">{t('trash.emptyHintWithProjects')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {trashItems.map((item) => {
                            if (item.type === 'project') {
                                const { project } = item;
                                return (
                                    <div
                                        key={`project-${project.id}`}
                                        className="rounded-lg px-3 py-3 flex items-center justify-between group hover:bg-muted/50 transition-colors"
                                    >
                                        <div>
                                            <h4 className="font-medium text-foreground line-through opacity-70">{project.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('trash.projectType')} · {renderDeletedAt(project.deletedAt)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => restoreProject(project.id)}
                                                className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                                                title={t('trash.restoreProject')}
                                            >
                                                <Undo2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    void handlePurgeProject(project);
                                                }}
                                                className="p-2 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                                                title={t('trash.deletePermanently')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            const { task } = item;
                            return (
                                <div
                                    key={`task-${task.id}`}
                                    className="rounded-lg px-3 py-3 flex items-center justify-between group hover:bg-muted/50 transition-colors"
                                >
                                    <div>
                                        <h4 className="font-medium text-foreground line-through opacity-70">{task.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('trash.taskType')} · {renderDeletedAt(task.deletedAt)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => restoreTask(task.id)}
                                            className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                                            title={t('trash.restoreToInbox')}
                                        >
                                            <Undo2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                void handlePurgeTask(task.id);
                                            }}
                                            className="p-2 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                                            title={t('trash.deletePermanently')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            </div>
            {confirmModal}
        </ErrorBoundary>
    );
}
