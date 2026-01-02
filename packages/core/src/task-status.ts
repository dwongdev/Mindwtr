import type { Task, TaskStatus } from './types';

const LEGACY_STATUS_MAP: Record<string, TaskStatus> = {
    todo: 'next',
    planned: 'next',
    pending: 'next',
    'in-progress': 'next',
    doing: 'next',
};

export function normalizeTaskStatus(value: unknown): TaskStatus {
    if (value === 'inbox' || value === 'next' || value === 'waiting' || value === 'someday' || value === 'done' || value === 'archived') {
        return value;
    }

    if (typeof value === 'string') {
        const lowered = value.toLowerCase().trim();
        if (lowered === 'inbox' || lowered === 'next' || lowered === 'waiting' || lowered === 'someday' || lowered === 'done' || lowered === 'archived') {
            return lowered as TaskStatus;
        }
        const mapped = LEGACY_STATUS_MAP[lowered];
        if (mapped) return mapped;
    }

    return 'inbox';
}

export function normalizeTaskForLoad(task: Task, nowIso: string = new Date().toISOString()): Task {
    const normalizedStatus = normalizeTaskStatus((task as any).status);

    const hasValidPushCount = typeof task.pushCount === 'number' && Number.isFinite(task.pushCount);
    const next: Task = {
        ...task,
        status: normalizedStatus,
        ...(hasValidPushCount ? {} : { pushCount: 0 }),
    };

    if (normalizedStatus === 'done' || normalizedStatus === 'archived') {
        next.completedAt = task.completedAt || task.updatedAt || nowIso;
        next.isFocusedToday = false;
    } else if (task.completedAt) {
        next.completedAt = undefined;
    }

    return next;
}
