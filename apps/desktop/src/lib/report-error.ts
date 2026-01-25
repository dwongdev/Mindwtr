import { useTaskStore } from '@mindwtr/core';
import { useUiStore } from '../store/ui-store';

type ReportErrorOptions = {
    category?: 'network' | 'validation' | 'permissions' | 'storage' | 'sync' | 'unknown';
    toast?: boolean;
};

export const reportError = (label: string, error: unknown, options?: ReportErrorOptions) => {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = options?.category ? `[${options.category}] ` : '';
    const fullMessage = `${label}: ${message}`;
    useTaskStore.getState().setError(`${prefix}${fullMessage}`);
    if (options?.toast !== false) {
        useUiStore.getState().showToast(fullMessage, 'error');
    }
    console.error(error);
};
