import React, { useCallback } from 'react';
import { Alert, Share } from 'react-native';
import {
    formatAIErrorAlertBody,
    Task,
    TaskStatus,
    TimeEstimate,
    createAIProvider,
    generateUUID,
    type AIProviderId,
    getUsedTaskTokens,
    tFallback,
    type StoreActionResult,
} from '@mindwtr/core';

import type { AIResponseAction } from '../ai-response-modal';
import { buildAIConfig, isAIKeyRequired, loadAIKey } from '../../lib/ai-config';
import { logTaskError, logTaskWarn } from './task-edit-modal.utils';
import { parseTokenList } from './task-edit-token-utils';
import { openProjectScreen, openTaskScreen } from '../../lib/task-meta-navigation';
import {
    setTaskDraftField,
    type TaskDraftSetter,
} from '@mindwtr/core/task-draft';
import {
    buildTaskEditUpdatePatch,
    isTaskEditDraftDirty,
    type TaskEditDraft,
} from './task-edit-draft-adapter';
import type { SetTaskEditDraftValue } from './use-task-edit-state';

type AIResponseModalState = {
    title: string;
    message?: string;
    actions: AIResponseAction[];
} | null;

type ShowToast = (options: {
    title: string;
    message: string;
    tone: 'warning' | 'error' | 'success' | 'info';
    durationMs?: number;
    actionLabel?: string;
    onAction?: () => void | Promise<void>;
}) => void;

type TaskEditActionsParams = {
    aiEnabled: boolean;
    baseTaskRef: React.MutableRefObject<Task | null>;
    closeAIModal: () => void;
    contextInputDraft: string;
    deleteTask: (taskId: string) => Promise<unknown>;
    descriptionDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    descriptionDraft: string;
    descriptionDraftRef: React.MutableRefObject<string>;
    duplicateTask: (taskId: string, includeDoneSubtasks?: boolean) => Promise<StoreActionResult>;
    promoteTaskToProject?: (taskId: string, options?: { title?: string; color?: string; areaId?: string }) => Promise<StoreActionResult>;
    mergedTask: Partial<Task>;
    taskEditDraft: TaskEditDraft | null;
    formatDate: (dateStr?: string) => string;
    formatDueDate: (dateStr?: string) => string;
    formatTimeEstimateLabel: (estimate: TimeEstimate) => string;
    isAIWorking: boolean;
    isContextInputFocused: boolean;
    isTagInputFocused: boolean;
    onClose: () => void;
    onSave: (taskId: string, updates: Partial<Task>) => void;
    prioritiesEnabled: boolean;
    projectContext?: Record<string, unknown> | null;
    resetTaskChecklist: (taskId: string) => Promise<unknown>;
    restoreTask: (taskId: string) => Promise<unknown>;
    sections: Array<{ id: string; projectId?: string; deletedAt?: string | null }>;
    setAiModal: React.Dispatch<React.SetStateAction<AIResponseModalState>>;
    setChecklist: SetTaskEditDraftValue<Task['checklist']>;
    setDraftField: TaskDraftSetter;
    setIsAIWorking: React.Dispatch<React.SetStateAction<boolean>>;
    setTitleImmediate: (text: string) => void;
    settings: Record<string, any>;
    showToast: ShowToast;
    t: (key: string) => string;
    tagInputDraft: string;
    task: Task | null;
    tasks: Task[];
    timeEstimatesEnabled: boolean;
    titleDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    titleDraftRef: React.MutableRefObject<string>;
};

export function useTaskEditActions({
    aiEnabled,
    baseTaskRef,
    closeAIModal,
    contextInputDraft,
    deleteTask,
    descriptionDebounceRef,
    descriptionDraft,
    descriptionDraftRef,
    duplicateTask,
    promoteTaskToProject,
    mergedTask,
    taskEditDraft,
    formatDate,
    formatDueDate,
    formatTimeEstimateLabel,
    isAIWorking,
    isContextInputFocused,
    isTagInputFocused,
    onClose,
    onSave,
    prioritiesEnabled,
    projectContext,
    resetTaskChecklist,
    restoreTask,
    sections,
    setAiModal,
    setChecklist,
    setDraftField,
    setIsAIWorking,
    setTitleImmediate,
    settings,
    showToast,
    t,
    tagInputDraft,
    task,
    tasks,
    timeEstimatesEnabled,
    titleDebounceRef,
    titleDraftRef,
}: TaskEditActionsParams) {
    const applyChecklistUpdate = useCallback((nextChecklist: NonNullable<Task['checklist']>) => {
        const currentStatus = taskEditDraft?.draft.status ?? task?.status ?? 'inbox';
        let nextStatus = currentStatus;
        if (task?.taskMode === 'list') {
            const allComplete = nextChecklist.length > 0 && nextChecklist.every((item) => item.isCompleted);
            if (allComplete) {
                nextStatus = 'done';
            } else if (currentStatus === 'done') {
                nextStatus = 'next';
            }
        }
        setChecklist(nextChecklist);
        if (nextStatus !== currentStatus) setDraftField('status', nextStatus);
    }, [setChecklist, setDraftField, task?.status, task?.taskMode, taskEditDraft?.draft.status]);

    const handleResetChecklist = useCallback(() => {
        const current = taskEditDraft?.checklist || [];
        if (current.length === 0 || !task) return;
        const reset = current.map((item) => ({ ...item, isCompleted: false }));
        applyChecklistUpdate(reset);
        resetTaskChecklist(task.id).catch((error) => logTaskError('Failed to reset checklist', error));
    }, [applyChecklistUpdate, resetTaskChecklist, task, taskEditDraft?.checklist]);

    const handleSave = useCallback(async () => {
        if (!task) return;
        if (titleDebounceRef.current) {
            clearTimeout(titleDebounceRef.current);
            titleDebounceRef.current = null;
        }
        if (descriptionDebounceRef.current) {
            clearTimeout(descriptionDebounceRef.current);
            descriptionDebounceRef.current = null;
        }

        const baseTask = baseTaskRef.current ?? task;
        if (!taskEditDraft) return;
        let saveDraft = taskEditDraft;
        const nextProjectId = saveDraft.draft.projectId;
        const nextSectionId = saveDraft.draft.sectionId;
        if (nextProjectId && nextSectionId) {
            const isValid = sections.some((section) =>
                section.id === nextSectionId && section.projectId === nextProjectId && !section.deletedAt
            );
            if (!isValid) {
                saveDraft = {
                    ...saveDraft,
                    draft: setTaskDraftField(saveDraft.draft, 'sectionId', ''),
                };
            }
        }

        const updates = buildTaskEditUpdatePatch(saveDraft, baseTask, {
            title: String(titleDraftRef.current ?? ''),
            description: descriptionDraftRef.current,
        });
        if (!updates || Object.keys(updates).length === 0) {
            onClose();
            return;
        }

        onSave(task.id, updates);
        onClose();
    }, [
        baseTaskRef,
        descriptionDebounceRef,
        descriptionDraftRef,
        onClose,
        onSave,
        sections,
        task,
        taskEditDraft,
        titleDebounceRef,
        titleDraftRef,
    ]);

    const handleShare = useCallback(async () => {
        if (!task) return;

        const title = String(titleDraftRef.current ?? mergedTask.title ?? task.title ?? '').trim();
        const lines: string[] = [];
        if (title) lines.push(title);

        const status = (mergedTask.status ?? task.status) as TaskStatus | undefined;
        if (status) lines.push(`${t('taskEdit.statusLabel')}: ${t(`status.${status}`)}`);
        if (prioritiesEnabled) {
            const priority = mergedTask.priority ?? task.priority;
            if (priority) lines.push(`${t('taskEdit.priorityLabel')}: ${t(`priority.${priority}`)}`);
        }
        if (mergedTask.startTime) lines.push(`${t('taskEdit.startDateLabel')}: ${formatDate(mergedTask.startTime)}`);
        if (mergedTask.dueDate) lines.push(`${t('taskEdit.dueDateLabel')}: ${formatDueDate(mergedTask.dueDate)}`);
        if (mergedTask.reviewAt) lines.push(`${t('taskEdit.reviewDateLabel')}: ${formatDate(mergedTask.reviewAt)}`);
        if (timeEstimatesEnabled) {
            const estimate = mergedTask.timeEstimate as TimeEstimate | undefined;
            if (estimate) lines.push(`${t('taskEdit.timeEstimateLabel')}: ${formatTimeEstimateLabel(estimate)}`);
        }

        const contexts = (mergedTask.contexts ?? []).filter(Boolean);
        if (contexts.length) lines.push(`${t('taskEdit.contextsLabel')}: ${contexts.join(', ')}`);

        const tags = (mergedTask.tags ?? []).filter(Boolean);
        if (tags.length) lines.push(`${t('taskEdit.tagsLabel')}: ${tags.join(', ')}`);

        const description = String(mergedTask.description ?? '').trim();
        if (description) {
            lines.push('');
            lines.push(`${t('taskEdit.descriptionLabel')}:`);
            lines.push(description);
        }

        const checklist = (mergedTask.checklist ?? []).filter((item) => item && item.title);
        if (checklist.length) {
            lines.push('');
            lines.push(`${t('taskEdit.checklist')}:`);
            checklist.forEach((item) => {
                lines.push(`${item.isCompleted ? '[x]' : '[ ]'} ${item.title}`);
            });
        }

        const message = lines.join('\n').trim();
        if (!message) return;

        try {
            await Share.share({
                title: title || undefined,
                message,
            });
        } catch (error) {
            logTaskError('Share failed:', error);
        }
    }, [mergedTask, formatDate, formatDueDate, formatTimeEstimateLabel, prioritiesEnabled, t, task, timeEstimatesEnabled, titleDraftRef]);

    const discardAndClose = useCallback(() => {
        if (titleDebounceRef.current) {
            clearTimeout(titleDebounceRef.current);
            titleDebounceRef.current = null;
        }
        if (descriptionDebounceRef.current) {
            clearTimeout(descriptionDebounceRef.current);
            descriptionDebounceRef.current = null;
        }
        onClose();
    }, [descriptionDebounceRef, onClose, titleDebounceRef]);

    const hasPendingChanges = useCallback((): boolean => {
        if (!task || !taskEditDraft) return false;

        const baseTask = baseTaskRef.current ?? task;
        let pendingDraft = taskEditDraft.draft;
        pendingDraft = setTaskDraftField(pendingDraft, 'title', String(titleDraftRef.current ?? pendingDraft.title));
        pendingDraft = setTaskDraftField(pendingDraft, 'description', String(descriptionDraftRef.current ?? pendingDraft.description));
        if (isContextInputFocused) {
            pendingDraft = setTaskDraftField(pendingDraft, 'contexts', parseTokenList(contextInputDraft, '@').join(', '));
        }
        if (isTagInputFocused) {
            pendingDraft = setTaskDraftField(pendingDraft, 'tags', parseTokenList(tagInputDraft, '#').join(', '));
        }
        return isTaskEditDraftDirty({ ...taskEditDraft, draft: pendingDraft }, baseTask);
    }, [
        baseTaskRef,
        contextInputDraft,
        descriptionDraftRef,
        isContextInputFocused,
        isTagInputFocused,
        tagInputDraft,
        task,
        taskEditDraft,
        titleDraftRef,
    ]);

    const handleAttemptClose = useCallback(() => {
        if (!hasPendingChanges()) {
            discardAndClose();
            return;
        }

        Alert.alert(
            t('taskEdit.discardChanges'),
            t('taskEdit.discardChangesDesc'),
            [
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                },
                {
                    text: t('common.discard'),
                    style: 'destructive',
                    onPress: discardAndClose,
                },
                {
                    text: t('common.save'),
                    onPress: () => {
                        void handleSave();
                    },
                },
            ],
            { cancelable: true },
        );
    }, [discardAndClose, handleSave, hasPendingChanges, t]);

    const handleDone = useCallback(() => {
        void handleSave();
    }, [handleSave]);

    const handleDuplicateTask = useCallback(async () => {
        if (!task) return;
        try {
            const result = await duplicateTask(task.id, false);
            if (!result.success || !result.id) {
                showToast({
                    title: tFallback(t, 'common.error', 'Error'),
                    message: result.error || t('task.duplicateFailed'),
                    tone: 'error',
                });
                return;
            }
            onClose();
            openTaskScreen(result.id, task.projectId, 'task');
        } catch (error) {
            logTaskError('Failed to duplicate task', error);
            showToast({
                title: tFallback(t, 'common.error', 'Error'),
                message: t('task.duplicateFailed'),
                tone: 'error',
            });
        }
    }, [duplicateTask, onClose, showToast, t, task]);

    const handlePromoteTaskToProject = useCallback(async () => {
        if (!task || !promoteTaskToProject) return;
        try {
            const title = String(titleDraftRef.current || mergedTask.title || task.title || '').trim();
            const result = await promoteTaskToProject(task.id, { title });
            if (!result.success || !result.id) {
                showToast({
                    title: tFallback(t, 'common.error', 'Error'),
                    message: result.error || t('task.promoteToProjectFailed'),
                    tone: 'error',
                });
                return;
            }
            showToast({
                title: tFallback(t, 'common.success', 'Success'),
                message: result.reused
                    ? t('task.promoteToProjectMoved')
                    : t('task.promoteToProjectCreated'),
                tone: 'success',
            });
            onClose();
            openProjectScreen(result.id);
        } catch (error) {
            logTaskError('Failed to create project from task', error);
            showToast({
                title: tFallback(t, 'common.error', 'Error'),
                message: t('task.promoteToProjectFailed'),
                tone: 'error',
            });
        }
    }, [mergedTask, onClose, promoteTaskToProject, showToast, t, task, titleDraftRef]);

    const handleDeleteTask = useCallback(async () => {
        if (!task) return;
        await deleteTask(task.id).catch((error) => logTaskError('Failed to delete task', error));
        showToast({
            title: t('common.notice') || 'Notice',
            message: t('list.taskDeleted') || 'Task deleted',
            tone: 'info',
            actionLabel: t('common.undo') || 'Undo',
            onAction: () => { void restoreTask(task.id); },
            durationMs: 5200,
        });
        onClose();
    }, [deleteTask, onClose, restoreTask, showToast, t, task]);

    const handleConvertToReference = useCallback(() => {
        if (!task) return;
        const referenceUpdate: Partial<Task> = {
            status: 'reference',
            startTime: undefined,
            dueDate: undefined,
            reviewAt: undefined,
            recurrence: undefined,
            showFutureRecurrence: undefined,
            priority: undefined,
            timeEstimate: undefined,
            isFocusedToday: false,
            pushCount: 0,
        };
        onSave(task.id, referenceUpdate);
        setDraftField('status', 'reference');
        setDraftField('startTime', '');
        setDraftField('dueDate', '');
        setDraftField('reviewAt', '');
        setDraftField('recurrence', '');
        setDraftField('recurrenceRRule', '');
        setDraftField('showFutureRecurrence', false);
        setDraftField('priority', '');
        setDraftField('timeEstimate', '');
        setDraftField('focusedToday', false);
    }, [onSave, setDraftField, task]);

    const getAIProvider = useCallback(async () => {
        if (!aiEnabled) {
            Alert.alert(t('ai.disabledTitle'), t('ai.disabledBody'));
            return null;
        }
        const provider = (settings.ai?.provider ?? 'openai') as AIProviderId;
        const apiKey = await loadAIKey(provider);
        if (isAIKeyRequired(settings) && !apiKey) {
            Alert.alert(t('ai.missingKeyTitle'), t('ai.missingKeyBody'));
            return null;
        }
        return createAIProvider(buildAIConfig(settings, apiKey));
    }, [aiEnabled, settings, t]);

    const applyAISuggestion = useCallback((suggested: { title?: string; context?: string; timeEstimate?: TimeEstimate }) => {
        if (suggested.title) {
            setTitleImmediate(suggested.title);
        }
        if (suggested.timeEstimate) setDraftField('timeEstimate', suggested.timeEstimate);
        if (suggested.context) {
            const contexts = (taskEditDraft?.draft.contexts ?? '').split(',').map((value) => value.trim()).filter(Boolean);
            setDraftField('contexts', Array.from(new Set([...contexts, suggested.context])).join(', '));
        }
    }, [setDraftField, setTitleImmediate, taskEditDraft?.draft.contexts]);

    const handleAIClarify = useCallback(async () => {
        if (!task || isAIWorking) return;
        const title = String(titleDraftRef.current ?? mergedTask.title ?? task.title ?? '').trim();
        if (!title) return;
        setIsAIWorking(true);
        try {
            const provider = await getAIProvider();
            if (!provider) return;
            const contextOptions = Array.from(new Set([
                ...getUsedTaskTokens(tasks, (item) => item.contexts, { prefix: '@' }),
                ...(mergedTask.contexts ?? []),
            ]));
            const response = await provider.clarifyTask({
                title,
                contexts: contextOptions,
                startTime: mergedTask.startTime ?? task.startTime,
                dueDate: mergedTask.dueDate ?? task.dueDate,
                reviewAt: mergedTask.reviewAt ?? task.reviewAt,
                ...(projectContext ?? {}),
            });
            const actions: AIResponseAction[] = response.options.slice(0, 3).map((option) => ({
                label: option.label,
                onPress: () => {
                    setTitleImmediate(option.action);
                    closeAIModal();
                },
            }));
            if (response.suggestedAction?.title) {
                actions.push({
                    label: t('ai.applySuggestion'),
                    variant: 'primary',
                    onPress: () => {
                        applyAISuggestion(response.suggestedAction!);
                        closeAIModal();
                    },
                });
            }
            actions.push({
                label: t('common.cancel'),
                variant: 'secondary',
                onPress: closeAIModal,
            });
            setAiModal({
                title: response.question || t('taskEdit.aiClarify'),
                actions,
            });
        } catch (error) {
            logTaskWarn('AI clarify failed', error);
            Alert.alert(t('ai.errorTitle'), formatAIErrorAlertBody(t('ai.errorBody'), error));
        } finally {
            setIsAIWorking(false);
        }
    }, [
        applyAISuggestion,
        closeAIModal,
        mergedTask,
        getAIProvider,
        isAIWorking,
        projectContext,
        setAiModal,
        setIsAIWorking,
        setTitleImmediate,
        t,
        task,
        tasks,
        titleDraftRef,
    ]);

    const handleAIBreakdown = useCallback(async () => {
        if (!task || isAIWorking) return;
        const title = String(titleDraftRef.current ?? mergedTask.title ?? task.title ?? '').trim();
        if (!title) return;
        setIsAIWorking(true);
        try {
            const provider = await getAIProvider();
            if (!provider) return;
            const response = await provider.breakDownTask({
                title,
                description: String(descriptionDraft ?? ''),
                ...(projectContext ?? {}),
            });
            const steps = response.steps.map((step) => step.trim()).filter(Boolean).slice(0, 8);
            if (steps.length === 0) return;
            setAiModal({
                title: t('ai.breakdownTitle'),
                message: steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
                actions: [
                    {
                        label: t('common.cancel'),
                        variant: 'secondary',
                        onPress: closeAIModal,
                    },
                    {
                        label: t('ai.addSteps'),
                        variant: 'primary',
                        onPress: () => {
                            const newItems = steps.map((step) => ({
                                id: generateUUID(),
                                title: step,
                                isCompleted: false,
                            }));
                            applyChecklistUpdate([...(taskEditDraft?.checklist || []), ...newItems]);
                            closeAIModal();
                        },
                    },
                ],
            });
        } catch (error) {
            logTaskWarn('AI breakdown failed', error);
            Alert.alert(t('ai.errorTitle'), formatAIErrorAlertBody(t('ai.errorBody'), error));
        } finally {
            setIsAIWorking(false);
        }
    }, [
        applyChecklistUpdate,
        closeAIModal,
        descriptionDraft,
        mergedTask,
        getAIProvider,
        isAIWorking,
        projectContext,
        setAiModal,
        setIsAIWorking,
        t,
        task,
        taskEditDraft?.checklist,
        titleDraftRef,
    ]);

    return {
        applyChecklistUpdate,
        handleAIClarify,
        handleAIBreakdown,
        handleAttemptClose,
        handleConvertToReference,
        handleDeleteTask,
        handleDone,
        handleDuplicateTask,
        handlePromoteTaskToProject,
        handleResetChecklist,
        handleSave,
        handleShare,
    };
}
