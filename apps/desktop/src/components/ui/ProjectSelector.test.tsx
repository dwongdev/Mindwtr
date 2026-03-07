import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Project } from '@mindwtr/core';

import { ProjectSelector } from './ProjectSelector';

const projects: Project[] = [
    { id: 'p1', title: 'Alpha', status: 'active', color: '#3b82f6', order: 0, tagIds: [], createdAt: '', updatedAt: '' },
    { id: 'p2', title: 'Work Project', status: 'active', color: '#10b981', order: 1, tagIds: [], areaId: 'a1', createdAt: '', updatedAt: '' },
];

describe('ProjectSelector', () => {
    it('suppresses create when an exact match exists outside the filtered list', () => {
        const { getByRole, getByLabelText, queryByText } = render(
            <ProjectSelector
                projects={[projects[0]]}
                allProjects={projects}
                value=""
                onChange={vi.fn()}
                onCreateProject={vi.fn()}
                placeholder="Select project"
                searchPlaceholder="Search projects"
                createProjectLabel="Create project"
            />
        );

        fireEvent.click(getByRole('button', { name: 'Select project' }));
        fireEvent.change(getByLabelText('Search projects'), { target: { value: 'Work Project' } });

        expect(queryByText(/Create project/i)).not.toBeInTheDocument();
    });

    it('shows the empty label before falling back to no-matches text', () => {
        const { getByRole, getByLabelText, getByText } = render(
            <ProjectSelector
                projects={[]}
                allProjects={projects}
                value=""
                onChange={vi.fn()}
                placeholder="Select project"
                searchPlaceholder="Search projects"
                noMatchesLabel="No matches"
                emptyLabel="No projects in this area."
            />
        );

        fireEvent.click(getByRole('button', { name: 'Select project' }));
        getByText('No projects in this area.');

        fireEvent.change(getByLabelText('Search projects'), { target: { value: 'zzz' } });
        getByText('No matches');
    });
});
