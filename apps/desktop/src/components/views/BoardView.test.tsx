import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { BoardView } from './BoardView';
import { LanguageProvider } from '../../contexts/language-context';
import { useTaskStore } from '@mindwtr/core';
import { useUiStore } from '../../store/ui-store';

vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PointerSensor: class {},
    useDroppable: () => ({ setNodeRef: () => {} }),
    useDraggable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: () => {},
        transform: null,
        isDragging: false,
    }),
    useSensor: () => ({}),
    useSensors: () => ([]),
    closestCorners: () => null,
}));

const renderWithProviders = () => {
    return render(
        <LanguageProvider>
            <BoardView />
        </LanguageProvider>
    );
};

describe('BoardView', () => {
    beforeEach(() => {
        useTaskStore.setState({
            tasks: [],
            projects: [],
            areas: [],
            settings: {},
        });
        useUiStore.setState({
            boardFilters: { selectedProjectIds: [], open: false },
        });
    });

    it('renders the column headers', () => {
        const { getByRole } = renderWithProviders();
        expect(getByRole('heading', { name: /inbox/i })).toBeInTheDocument();
        expect(getByRole('heading', { name: /next actions/i })).toBeInTheDocument();
    });

    it('exposes the project filter panel state with aria-expanded', () => {
        const { getByRole } = renderWithProviders();

        const filtersButton = getByRole('button', { name: /show/i });
        expect(filtersButton).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(filtersButton);
        expect(getByRole('button', { name: /hide/i })).toHaveAttribute('aria-expanded', 'true');
    });
});
