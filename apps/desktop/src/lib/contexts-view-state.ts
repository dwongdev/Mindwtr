import type { TaskStatus } from '@mindwtr/core';

export const CONTEXTS_VIEW_STATE_STORAGE_KEY = 'mindwtr:view:contexts:v1';
export const NO_CONTEXT_TOKEN = '__no_context__';
export const CONTEXTS_TOKEN_SELECTION_EVENT = 'mindwtr:contexts-token-selection';

const CONTEXT_STATUS_VALUES: Array<TaskStatus | 'all'> = ['all', 'inbox', 'next', 'waiting', 'someday', 'reference', 'done'];

export type ContextsPersistedViewState = {
    selectedContext: string | null;
    statusFilter: TaskStatus | 'all';
};

export const DEFAULT_CONTEXTS_VIEW_STATE: ContextsPersistedViewState = {
    selectedContext: null,
    statusFilter: 'all',
};

export type ContextsTokenSelectionEventDetail = {
    selectedContext: string | null;
};

export function sanitizeContextsViewState(
    value: unknown,
    fallback: ContextsPersistedViewState,
): ContextsPersistedViewState {
    const parsed = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<ContextsPersistedViewState>
        : {};
    const selectedContext = typeof parsed.selectedContext === 'string' && parsed.selectedContext.trim()
        ? parsed.selectedContext
        : null;
    return {
        selectedContext,
        statusFilter: CONTEXT_STATUS_VALUES.includes(parsed.statusFilter as TaskStatus | 'all')
            ? parsed.statusFilter as TaskStatus | 'all'
            : fallback.statusFilter,
    };
}

export function readContextsViewState(): ContextsPersistedViewState {
    if (typeof window === 'undefined') return DEFAULT_CONTEXTS_VIEW_STATE;
    try {
        const raw = window.localStorage.getItem(CONTEXTS_VIEW_STATE_STORAGE_KEY);
        if (!raw) return DEFAULT_CONTEXTS_VIEW_STATE;
        return sanitizeContextsViewState(JSON.parse(raw) as unknown, DEFAULT_CONTEXTS_VIEW_STATE);
    } catch {
        return DEFAULT_CONTEXTS_VIEW_STATE;
    }
}

export function persistContextsViewSelection(selectedContext: string | null): ContextsPersistedViewState {
    const nextState = {
        ...readContextsViewState(),
        selectedContext,
    };
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(CONTEXTS_VIEW_STATE_STORAGE_KEY, JSON.stringify(nextState));
        } catch {
            // View state is non-critical; navigation should still proceed.
        }
    }
    return nextState;
}

export function dispatchContextsTokenSelection(selectedContext: string | null): void {
    persistContextsViewSelection(selectedContext);
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent<ContextsTokenSelectionEventDetail>(CONTEXTS_TOKEN_SELECTION_EVENT, {
            detail: { selectedContext },
        }),
    );
}

export function subscribeContextsTokenSelection(
    handler: (detail: ContextsTokenSelectionEventDetail) => void,
): () => void {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const listener: EventListener = (event) => {
        const detail = (event as CustomEvent<ContextsTokenSelectionEventDetail | undefined>).detail;
        if (!detail) return;
        handler(detail);
    };

    window.addEventListener(CONTEXTS_TOKEN_SELECTION_EVENT, listener);
    return () => window.removeEventListener(CONTEXTS_TOKEN_SELECTION_EVENT, listener);
}
