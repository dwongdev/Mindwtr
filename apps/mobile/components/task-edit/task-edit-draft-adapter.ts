import type { Task } from '@mindwtr/core';
import {
    createTaskDraft,
    setTaskDraftField,
    type TaskDraft,
} from '@mindwtr/core/task-draft';

const TASK_DRAFT_DATE_FIELDS = [
    'dueDate',
    'startTime',
    'relativeStartOffset',
    'reviewAt',
] as const;

type TaskDraftDateField = typeof TASK_DRAFT_DATE_FIELDS[number];

const legacyDateValueToDraft = <K extends TaskDraftDateField>(
    field: K,
    value: Partial<Task>[K],
): TaskDraft[K] => {
    if (field === 'relativeStartOffset') {
        return value as TaskDraft[K];
    }
    return (value ?? '') as TaskDraft[K];
};

/**
 * Zero-churn bridge for the incremental mobile TaskDraft migration.
 *
 * The mobile editor still exposes Partial<Task> to its existing field hooks,
 * but migrated date writes pass through core's single TaskDraft write path.
 * Only changed date fields are projected back, so untouched ISO values and
 * every non-date field keep their existing representation and behavior.
 */
export function applyTaskDraftDateFieldUpdates(
    current: Partial<Task>,
    next: Partial<Task>,
    baseTask: Task | null,
): Partial<Task> {
    if (!baseTask) return next;

    const changedFields = TASK_DRAFT_DATE_FIELDS.filter(
        (field) => current[field] !== next[field],
    );
    if (changedFields.length === 0) return next;

    let draft = createTaskDraft({ ...baseTask, ...current });
    for (const field of changedFields) {
        draft = setTaskDraftField(draft, field, legacyDateValueToDraft(field, next[field]));
    }

    const adapted: Partial<Task> = { ...next };
    for (const field of changedFields) {
        if (field === 'relativeStartOffset') {
            adapted.relativeStartOffset = draft.relativeStartOffset;
        } else {
            adapted[field] = draft[field] || undefined;
        }
    }
    return adapted;
}
