import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Task } from '@mindwtr/core';

import { ProjectWorkspace } from './ProjectWorkspace';

vi.mock('../../TaskItem', () => ({
    TaskItem: ({
        task,
        selectionMode,
        isMultiSelected,
        onToggleSelect,
    }: {
        task: Task;
        selectionMode?: boolean;
        isMultiSelected?: boolean;
        onToggleSelect?: (options?: { range?: boolean }) => void;
    }) => (
        <div data-task-id={task.id}>
            {selectionMode && (
                <input
                    type="checkbox"
                    aria-label="Select task"
                    checked={Boolean(isMultiSelected)}
                    onClick={(event) => onToggleSelect?.({ range: event.shiftKey })}
                    onChange={() => undefined}
                />
            )}
            <span>{task.title}</span>
        </div>
    ),
}));

vi.mock('../../PromptModal', () => ({
    PromptModal: () => null,
}));

vi.mock('../../TokenPickerModal', () => ({
    TokenPickerModal: () => null,
}));

vi.mock('./ProjectDetailsHeader', () => ({
    ProjectDetailsHeader: ({ project }: { project: Project }) => <div>{project.title}</div>,
}));

vi.mock('./ProjectDetailsFields', () => ({
    ProjectDetailsFields: () => null,
}));

vi.mock('./ProjectNotesSection', () => ({
    ProjectNotesSection: () => null,
}));

const translations: Record<string, string> = {
    'bulk.addContext': 'Add context',
    'bulk.addTag': 'Add tag',
    'bulk.delete': 'Delete',
    'bulk.exitSelect': 'Exit Select',
    'bulk.moveTo': 'Move to',
    'bulk.removeContext': 'Remove context',
    'bulk.removeTag': 'Remove tag',
    'bulk.select': 'Select',
    'bulk.selected': 'selected',
    'common.all': 'All',
    'common.cancel': 'Cancel',
    'common.clear': 'Clear',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.search': 'Search...',
    'common.tasks': 'tasks',
    'list.confirmBatchDelete': 'Delete selected tasks?',
    'projects.addSection': 'Add section',
    'projects.addTask': 'Add task',
    'projects.addTaskPlaceholder': 'Add task',
    'projects.noActiveTasks': 'No active tasks',
    'projects.sectionsLabel': 'Tasks',
    'sort.default': 'Default',
    'sort.due': 'Due date',
    'sort.label': 'Sort',
    'status.done': 'Done',
    'status.inbox': 'Inbox',
    'status.next': 'Next',
    'status.reference': 'Reference',
    'status.someday': 'Someday',
    'status.waiting': 'Waiting',
};

const t = (key: string) => translations[key] ?? key;

const project: Project = {
    id: 'project-1',
    title: 'Launch',
    color: '#3b82f6',
    order: 0,
    status: 'active',
    tagIds: [],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
};

const task = (id: string, title: string, overrides: Partial<Task> = {}): Task => ({
    id,
    title,
    status: 'next',
    projectId: project.id,
    tags: [],
    contexts: [],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
    ...overrides,
});

type ProjectWorkspaceProps = ComponentProps<typeof ProjectWorkspace>;

const defaultProps: ProjectWorkspaceProps = {
    addProject: vi.fn(),
    addSection: vi.fn(),
    addTask: vi.fn(),
    allTasks: [],
    allTokens: [],
    areaById: new Map(),
    areas: [],
    batchDeleteTasks: vi.fn(),
    batchMoveTasks: vi.fn(),
    batchUpdateTasks: vi.fn(),
    deleteProject: vi.fn(),
    deleteSection: vi.fn(),
    highlightTaskId: null,
    isAreaCreating: false,
    isCreatingProject: false,
    language: 'en',
    noAreaId: '__none__',
    onDuplicateProject: vi.fn(),
    onManageAreas: vi.fn(),
    onRequestQuickArea: vi.fn(),
    onToggleShowCompletedTasks: vi.fn(),
    projects: [project],
    reorderProjectTasks: vi.fn(),
    reorderSections: vi.fn(),
    requestConfirmation: vi.fn(),
    restoreProject: vi.fn(),
    sections: [],
    selectedProject: project,
    selectedProjectId: project.id,
    setHighlightTask: vi.fn(),
    setSelectedProjectId: vi.fn(),
    showCompletedTasks: false,
    showToast: vi.fn(),
    sortedAreas: [],
    t,
    undoNotificationsEnabled: true,
    updateProject: vi.fn(),
    updateSection: vi.fn(),
    updateTask: vi.fn(),
};

const renderWorkspace = (overrides: Partial<ProjectWorkspaceProps> = {}) => render(
    <ProjectWorkspace
        {...defaultProps}
        {...overrides}
    />
);

describe('ProjectWorkspace Select mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('selects all visible project tasks and clears the selection', () => {
        const allTasks = [
            task('task-1', 'First task'),
            task('task-2', 'Second task'),
        ];
        const { getAllByRole, getByRole } = renderWorkspace({ allTasks });

        fireEvent.click(getByRole('button', { name: 'Select' }));
        expect(getByRole('button', { name: 'Select All' })).toBeEnabled();
        expect(getByRole('button', { name: 'Clear' })).toBeDisabled();

        fireEvent.click(getByRole('button', { name: 'Select All' }));

        expect(getAllByRole('checkbox', { name: 'Select task' }).map((checkbox) => (
            (checkbox as HTMLInputElement).checked
        ))).toEqual([true, true]);
        expect(getByRole('button', { name: 'Select All' })).toBeDisabled();
        expect(getByRole('button', { name: 'Clear' })).toBeEnabled();

        fireEvent.click(getByRole('button', { name: 'Clear' }));

        expect(getAllByRole('checkbox', { name: 'Select task' }).map((checkbox) => (
            (checkbox as HTMLInputElement).checked
        ))).toEqual([false, false]);
    });

    it('selects a contiguous project task range with shift-click', () => {
        const allTasks = [
            task('task-1', 'First task'),
            task('task-2', 'Second task'),
            task('task-3', 'Third task'),
        ];
        const { getAllByRole, getByRole } = renderWorkspace({ allTasks });

        fireEvent.click(getByRole('button', { name: 'Select' }));
        const checkboxes = getAllByRole('checkbox', { name: 'Select task' });

        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[2], { shiftKey: true });

        expect(getAllByRole('checkbox', { name: 'Select task' }).map((checkbox) => (
            (checkbox as HTMLInputElement).checked
        ))).toEqual([true, true, true]);
    });

    it('bulk deletes selected project tasks after confirmation', async () => {
        const batchDeleteTasks = vi.fn();
        const requestConfirmation = vi.fn().mockResolvedValue(true);
        const allTasks = [
            task('task-1', 'First task'),
            task('task-2', 'Second task'),
        ];
        const { getByRole } = renderWorkspace({
            allTasks,
            batchDeleteTasks,
            requestConfirmation,
        });

        fireEvent.click(getByRole('button', { name: 'Select' }));
        fireEvent.click(getByRole('button', { name: 'Select All' }));
        fireEvent.click(getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(requestConfirmation).toHaveBeenCalled();
            expect(batchDeleteTasks).toHaveBeenCalledWith(['task-1', 'task-2']);
        });
    });

    it('sorts visible project tasks by due date when selected', () => {
        const allTasks = [
            task('task-no-due', 'No due', { createdAt: '2026-05-01T00:00:00.000Z', order: 0 }),
            task('task-later', 'Later due', { createdAt: '2026-05-02T00:00:00.000Z', dueDate: '2026-07-01', order: 1 }),
            task('task-soon', 'Soon due', { createdAt: '2026-05-03T00:00:00.000Z', dueDate: '2026-06-01', order: 2 }),
        ];
        const { container, getByRole } = renderWorkspace({ allTasks });
        const taskTitles = () => Array.from(container.querySelectorAll('[data-task-id] span')).map((item) => item.textContent);

        expect(taskTitles()).toEqual(['No due', 'Later due', 'Soon due']);

        fireEvent.click(getByRole('button', { name: 'Due date' }));

        expect(taskTitles()).toEqual(['Soon due', 'Later due', 'No due']);
    });
});
