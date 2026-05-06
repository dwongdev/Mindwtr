import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useTaskStore } from '@mindwtr/core';

import { LanguageProvider } from '../contexts/language-context';
import { QuickAddModal } from './QuickAddModal';

const initialTaskState = useTaskStore.getState();

const renderQuickAddModal = () => render(
    <LanguageProvider>
        <QuickAddModal />
    </LanguageProvider>
);

beforeEach(() => {
    act(() => {
        useTaskStore.setState(initialTaskState, true);
        useTaskStore.setState((state) => ({
            ...state,
            projects: [],
            areas: [],
            settings: {
                ...state.settings,
                filters: {
                    ...(state.settings?.filters ?? {}),
                    areaId: 'all',
                },
                gtd: {
                    ...(state.settings?.gtd ?? {}),
                    defaultCaptureMethod: 'text',
                },
            },
        }));
    });
});

describe('QuickAddModal', () => {
    it('ignores duplicate open requests while the first open is still committing', async () => {
        renderQuickAddModal();

        await act(async () => {
            window.dispatchEvent(new CustomEvent('mindwtr:quick-add', {
                detail: { initialValue: 'First capture' },
            }));
            window.dispatchEvent(new CustomEvent('mindwtr:quick-add', {
                detail: { initialValue: 'Second capture' },
            }));
            await Promise.resolve();
        });

        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.getByPlaceholderText('Add Task')).toHaveValue('First capture');
    });
});
