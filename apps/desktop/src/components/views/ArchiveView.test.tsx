import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Project, Task } from '@mindwtr/core';
import { safeFormatDate, useTaskStore } from '@mindwtr/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../contexts/language-context';
import { ArchiveView } from './ArchiveView';

const initialTaskState = useTaskStore.getState();

const archivedTask: Task = {
    id: 'task-1',
    title: 'Archived task',
    status: 'archived',
    tags: [],
    contexts: [],
    completedAt: '2026-05-12T08:30:00.000Z',
    createdAt: '2026-05-10T08:30:00.000Z',
    updatedAt: '2026-05-12T08:30:00.000Z',
};

const archivedProject: Project = {
    id: 'project-1',
    title: 'Archived project',
    status: 'archived',
    color: '#6B7280',
    order: 0,
    tagIds: [],
    createdAt: '2026-05-01T08:30:00.000Z',
    updatedAt: '2026-05-11T08:30:00.000Z',
};

describe('ArchiveView', () => {
    beforeEach(() => {
        useTaskStore.setState(initialTaskState, true);
        useTaskStore.setState({
            tasks: [],
            _allTasks: [archivedTask],
            _tasksById: new Map([[archivedTask.id, archivedTask]]),
            projects: [],
            _allProjects: [],
            settings: {},
        });
    });

    it('shows the archived task completion date and time', () => {
        const completionLabel = safeFormatDate(archivedTask.completedAt, 'Pp');

        const { getByText } = render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        expect(getByText('Archived task')).toBeInTheDocument();
        expect(getByText(`Completed: ${completionLabel}`)).toBeInTheDocument();
    });

    it('moves an archived task to Trash instead of purging it', async () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByTitle('Delete'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            const deletedTask = useTaskStore.getState()._tasksById.get(archivedTask.id);
            expect(deletedTask?.deletedAt).toBeTruthy();
            expect(deletedTask?.purgedAt).toBeUndefined();
        });
    });

    it('bulk restores selected archived tasks to Inbox', async () => {
        const secondArchivedTask: Task = {
            ...archivedTask,
            id: 'task-2',
            title: 'Second archived task',
        };
        useTaskStore.setState({
            _allTasks: [archivedTask, secondArchivedTask],
            _tasksById: new Map([
                [archivedTask.id, archivedTask],
                [secondArchivedTask.id, secondArchivedTask],
            ]),
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('button', { name: /Select all/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Restore to Inbox' }));

        await waitFor(() => {
            expect(useTaskStore.getState()._tasksById.get(archivedTask.id)?.status).toBe('inbox');
            expect(useTaskStore.getState()._tasksById.get(secondArchivedTask.id)?.status).toBe('inbox');
        });
    });

    it('bulk moves selected archived tasks back to Done without changing completion time', async () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Archived task' }));
        fireEvent.click(screen.getByRole('button', { name: 'Move to Done' }));

        await waitFor(() => {
            const movedTask = useTaskStore.getState()._tasksById.get(archivedTask.id);
            expect(movedTask?.status).toBe('done');
            expect(movedTask?.completedAt).toBe(archivedTask.completedAt);
        });
    });

    it('bulk moves selected archived tasks to Trash', async () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Archived task' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            const deletedTask = useTaskStore.getState()._tasksById.get(archivedTask.id);
            expect(deletedTask?.deletedAt).toBeTruthy();
            expect(deletedTask?.purgedAt).toBeUndefined();
        });
    });

    it('lists archived projects when the Projects segment is selected', () => {
        useTaskStore.setState({
            projects: [archivedProject],
            _allProjects: [archivedProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        expect(screen.queryByText('Archived project')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        expect(screen.getByText('Archived project')).toBeInTheDocument();
    });

    it('shows the projects empty state when there are no archived projects', () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        expect(screen.getByText('No archived projects')).toBeInTheDocument();
    });

    it('restores an archived project via updateProject with active status', async () => {
        useTaskStore.setState({
            projects: [archivedProject],
            _allProjects: [archivedProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        fireEvent.click(screen.getByTitle('Restore project'));

        await waitFor(() => {
            const restored = useTaskStore.getState()._allProjects.find((p) => p.id === archivedProject.id);
            expect(restored?.status).toBe('active');
            expect(restored?.deletedAt).toBeUndefined();
        });
    });

    it('soft-deletes an archived project after confirmation', async () => {
        useTaskStore.setState({
            projects: [archivedProject],
            _allProjects: [archivedProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        fireEvent.click(screen.getByTitle('Delete'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            const deleted = useTaskStore.getState()._allProjects.find((p) => p.id === archivedProject.id);
            expect(deleted?.deletedAt).toBeTruthy();
            expect(deleted?.purgedAt).toBeUndefined();
        });
    });

    it('filters archived projects by title search', () => {
        const secondProject: Project = { ...archivedProject, id: 'project-2', title: 'Second archived project' };
        useTaskStore.setState({
            projects: [archivedProject, secondProject],
            _allProjects: [archivedProject, secondProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        fireEvent.change(screen.getByPlaceholderText('Search archived projects...'), {
            target: { value: 'Second' },
        });

        expect(screen.getByText('Second archived project')).toBeInTheDocument();
        expect(screen.queryByText('Archived project')).not.toBeInTheDocument();
    });
});
