import React from 'react';
import { type Attachment, type RecurrenceWeekday, type Task } from '@mindwtr/core';
import {
    setTaskDraftField,
    type TaskDraft,
    type TaskDraftField,
} from '@mindwtr/core/task-draft';
import { getRecurrenceByDayValue } from './recurrence-utils';
import {
    createTaskEditDraft,
    type TaskEditDraft,
} from './task-edit-draft-adapter';

export type TaskEditTab = 'task' | 'view';

export type SetTaskEditDraftValue<T> = (
    value: T | ((current: T) => T),
    markDirty?: boolean,
) => void;

export type SetTaskEditDraftField = <K extends TaskDraftField>(
    field: K,
    value: TaskDraft[K],
    markDirty?: boolean,
) => void;

export function resolveInitialTaskEditTab(target?: TaskEditTab, currentTask?: Task | null): TaskEditTab {
    if (target) return target;
    if (currentTask?.taskMode === 'list') return 'view';
    return 'view';
}

type UseTaskEditStateParams = {
    defaultTab?: TaskEditTab;
    resetCopilotStateRef: React.MutableRefObject<() => void>;
    task: Task | null;
    tasks: Task[];
    visible: boolean;
};

export function useTaskEditState({
    defaultTab,
    resetCopilotStateRef,
    task,
    tasks,
    visible,
}: UseTaskEditStateParams) {
    const liveTask = React.useMemo(() => {
        if (!task?.id) return task ?? null;
        return tasks.find((item) => item.id === task.id) ?? task;
    }, [task, tasks]);

    const [taskEditDraft, setTaskEditDraftState] = React.useState<TaskEditDraft | null>(null);
    const isDirtyRef = React.useRef(false);
    const baseTaskRef = React.useRef<Task | null>(null);
    const setDraftField = React.useCallback<SetTaskEditDraftField>((field, value, markDirty = true) => {
        if (markDirty) isDirtyRef.current = true;
        setTaskEditDraftState((current) => {
            if (!current) return current;
            const draft = setTaskDraftField(current.draft, field, value);
            return draft === current.draft ? current : { ...current, draft };
        });
    }, []);
    const setChecklist = React.useCallback<SetTaskEditDraftValue<Task['checklist']>>((value, markDirty = true) => {
        if (markDirty) isDirtyRef.current = true;
        setTaskEditDraftState((current) => {
            if (!current) return current;
            const checklist = typeof value === 'function' ? value(current.checklist) : value;
            return checklist === current.checklist ? current : { ...current, checklist };
        });
    }, []);
    const setAttachments = React.useCallback<SetTaskEditDraftValue<Attachment[] | undefined>>((value, markDirty = true) => {
        if (markDirty) isDirtyRef.current = true;
        setTaskEditDraftState((current) => {
            if (!current) return current;
            const attachments = typeof value === 'function' ? value(current.attachments) : value;
            return attachments === current.attachments ? current : { ...current, attachments };
        });
    }, []);

    const [showDatePicker, setShowDatePicker] = React.useState<'start' | 'start-time' | 'due' | 'due-time' | 'review' | 'recurrence-end' | null>(null);
    const [pendingStartDate, setPendingStartDate] = React.useState<Date | null>(null);
    const [pendingDueDate, setPendingDueDate] = React.useState<Date | null>(null);
    const [editTab, setEditTab] = React.useState<TaskEditTab>(() => resolveInitialTaskEditTab(defaultTab, task));
    const [showDescriptionPreview, setShowDescriptionPreview] = React.useState(false);
    const [showAreaPicker, setShowAreaPicker] = React.useState(false);
    const [titleDraft, setTitleDraft] = React.useState('');
    const titleDraftRef = React.useRef('');
    const titleDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [descriptionDraft, setDescriptionDraft] = React.useState('');
    const descriptionDraftRef = React.useRef('');
    const descriptionDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [contextInputDraft, setContextInputDraft] = React.useState('');
    const [tagInputDraft, setTagInputDraft] = React.useState('');
    const [isContextInputFocused, setIsContextInputFocused] = React.useState(false);
    const [isTagInputFocused, setIsTagInputFocused] = React.useState(false);
    const [showProjectPicker, setShowProjectPicker] = React.useState(false);
    const [showSectionPicker, setShowSectionPicker] = React.useState(false);
    const [customWeekdays, setCustomWeekdays] = React.useState<RecurrenceWeekday[]>([]);
    const [isAIWorking, setIsAIWorking] = React.useState(false);
    const [aiModal, setAiModal] = React.useState<{ title: string; message?: string; actions: { label: string; variant?: 'primary' | 'secondary'; onPress: () => void }[] } | null>(null);

    React.useEffect(() => {
        if (!visible) {
            setTaskEditDraftState(null);
            baseTaskRef.current = null;
            isDirtyRef.current = false;
            setShowDescriptionPreview(false);
            if (titleDebounceRef.current) {
                clearTimeout(titleDebounceRef.current);
                titleDebounceRef.current = null;
            }
            titleDraftRef.current = '';
            setTitleDraft('');
            descriptionDraftRef.current = '';
            setDescriptionDraft('');
            setContextInputDraft('');
            setTagInputDraft('');
            setIsContextInputFocused(false);
            setIsTagInputFocused(false);
            setEditTab(resolveInitialTaskEditTab(defaultTab, null));
            setCustomWeekdays([]);
            return;
        }

        if (liveTask) {
            const byDay = getRecurrenceByDayValue(liveTask.recurrence);
            const taskChanged = baseTaskRef.current?.id !== liveTask.id;
            const updatedChanged = baseTaskRef.current?.updatedAt !== liveTask.updatedAt;
            if (taskChanged || (!isDirtyRef.current && updatedChanged)) {
                setCustomWeekdays(byDay);
                setTaskEditDraftState(createTaskEditDraft(liveTask));
                baseTaskRef.current = liveTask;
                isDirtyRef.current = false;
                setShowDescriptionPreview(false);
                const nextTitle = String(liveTask.title ?? '');
                if (titleDebounceRef.current) {
                    clearTimeout(titleDebounceRef.current);
                    titleDebounceRef.current = null;
                }
                titleDraftRef.current = nextTitle;
                setTitleDraft(nextTitle);
                const nextDescription = String(liveTask.description ?? '');
                descriptionDraftRef.current = nextDescription;
                setDescriptionDraft(nextDescription);
                setContextInputDraft((liveTask.contexts ?? []).join(', '));
                setTagInputDraft((liveTask.tags ?? []).join(', '));
                setIsContextInputFocused(false);
                setIsTagInputFocused(false);
                setEditTab(resolveInitialTaskEditTab(defaultTab, liveTask));
                resetCopilotStateRef.current();
            }
        } else {
            setTaskEditDraftState(null);
            baseTaskRef.current = null;
            isDirtyRef.current = false;
            setShowDescriptionPreview(false);
            if (titleDebounceRef.current) {
                clearTimeout(titleDebounceRef.current);
                titleDebounceRef.current = null;
            }
            titleDraftRef.current = '';
            setTitleDraft('');
            descriptionDraftRef.current = '';
            setDescriptionDraft('');
            setContextInputDraft('');
            setTagInputDraft('');
            setIsContextInputFocused(false);
            setIsTagInputFocused(false);
            setEditTab(resolveInitialTaskEditTab(defaultTab, null));
            setCustomWeekdays([]);
        }
    }, [defaultTab, liveTask, resetCopilotStateRef, visible]);

    React.useEffect(() => {
        if (!visible) {
            setAiModal(null);
        }
    }, [visible]);

    React.useEffect(() => {
        if (!visible) {
            if (titleDebounceRef.current) {
                clearTimeout(titleDebounceRef.current);
                titleDebounceRef.current = null;
            }
            if (descriptionDebounceRef.current) {
                clearTimeout(descriptionDebounceRef.current);
                descriptionDebounceRef.current = null;
            }
        }
    }, [visible]);

    React.useEffect(() => {
        if (!visible || isContextInputFocused) return;
        const normalized = taskEditDraft?.draft.contexts ?? '';
        if (contextInputDraft !== normalized) {
            setContextInputDraft(normalized);
        }
    }, [contextInputDraft, isContextInputFocused, taskEditDraft?.draft.contexts, visible]);

    React.useEffect(() => {
        if (!visible || isTagInputFocused) return;
        const normalized = taskEditDraft?.draft.tags ?? '';
        if (tagInputDraft !== normalized) {
            setTagInputDraft(normalized);
        }
    }, [isTagInputFocused, tagInputDraft, taskEditDraft?.draft.tags, visible]);

    React.useEffect(() => () => {
        if (titleDebounceRef.current) {
            clearTimeout(titleDebounceRef.current);
            titleDebounceRef.current = null;
        }
        if (descriptionDebounceRef.current) {
            clearTimeout(descriptionDebounceRef.current);
            descriptionDebounceRef.current = null;
        }
    }, []);

    return {
        aiModal,
        baseTaskRef,
        contextInputDraft,
        customWeekdays,
        descriptionDebounceRef,
        descriptionDraft,
        descriptionDraftRef,
        editTab,
        isAIWorking,
        isContextInputFocused,
        isDirtyRef,
        isTagInputFocused,
        liveTask,
        pendingDueDate,
        pendingStartDate,
        setAiModal,
        setAttachments,
        setChecklist,
        setContextInputDraft,
        setCustomWeekdays,
        setDescriptionDraft,
        setDraftField,
        setEditTab,
        setIsAIWorking,
        setIsContextInputFocused,
        setIsTagInputFocused,
        setPendingDueDate,
        setPendingStartDate,
        setShowAreaPicker,
        setShowDatePicker,
        setShowDescriptionPreview,
        setShowProjectPicker,
        setShowSectionPicker,
        setTagInputDraft,
        setTitleDraft,
        showAreaPicker,
        showDatePicker,
        showDescriptionPreview,
        showProjectPicker,
        showSectionPicker,
        tagInputDraft,
        taskEditDraft,
        titleDebounceRef,
        titleDraft,
        titleDraftRef,
    };
}
