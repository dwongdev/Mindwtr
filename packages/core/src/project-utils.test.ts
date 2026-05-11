import { describe, it, expect } from 'vitest';
import {
    projectHasNextAction,
    filterProjectsNeedingNextAction,
    filterProjectsBySelectedArea,
    getProjectsByArea,
    getProjectsByTag,
    isSelectableProjectForTaskAssignment,
} from './project-utils';
import type { Project, Task } from './types';

describe('project-utils', () => {
    const projects: Project[] = [
        { id: 'p1', title: 'Alpha', status: 'active', tagIds: ['t1'], areaId: 'a1', createdAt: '', updatedAt: '' },
        { id: 'p2', title: 'Beta', status: 'active', tagIds: [], areaId: 'a1', createdAt: '', updatedAt: '' },
        { id: 'p3', title: 'Gamma', status: 'someday', tagIds: ['t1'], areaId: 'a2', createdAt: '', updatedAt: '' },
        { id: 'p4', title: 'Delta', status: 'active', tagIds: ['t2'], createdAt: '', updatedAt: '' },
        { id: 'p5', title: 'Hidden', status: 'active', tagIds: [], areaId: 'a1', deletedAt: '2026-03-07T00:00:00.000Z', createdAt: '', updatedAt: '' },
    ];

    const tasks: Task[] = [
        { id: 't1', title: 'Next action', status: 'next', projectId: 'p1', tags: [], contexts: [], createdAt: '', updatedAt: '' },
        { id: 't2', title: 'Waiting action', status: 'waiting', projectId: 'p2', tags: [], contexts: [], createdAt: '', updatedAt: '' },
    ];

    it('detects projects with next actions', () => {
        expect(projectHasNextAction(projects[0], tasks)).toBe(true);
        expect(projectHasNextAction(projects[1], tasks)).toBe(false);
    });

    it('filters projects needing next actions', () => {
        const needing = filterProjectsNeedingNextAction(projects, tasks);
        expect(needing.map((p) => p.id)).toEqual(['p2', 'p4']);
    });

    it('filters projects by area', () => {
        const areaProjects = getProjectsByArea(projects, 'a1');
        expect(areaProjects.map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('filters project picker choices by selected area', () => {
        const pickerProjects: Project[] = [
            ...projects,
            { id: 'p6', title: 'Archived', status: 'archived', tagIds: [], areaId: 'a1', createdAt: '', updatedAt: '' },
            { id: 'p7', title: 'Completed', status: 'completed' as Project['status'], tagIds: [], areaId: 'a1', createdAt: '', updatedAt: '' },
        ];
        expect(filterProjectsBySelectedArea(pickerProjects).map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
        expect(filterProjectsBySelectedArea(pickerProjects, 'a1').map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('marks archived and legacy completed projects as unavailable for task assignment', () => {
        const archivedProject: Project = { id: 'p6', title: 'Archived', status: 'archived', tagIds: [], areaId: 'a1', createdAt: '', updatedAt: '' };
        const completedProject: Project = { id: 'p7', title: 'Completed', status: 'completed' as Project['status'], tagIds: [], areaId: 'a1', createdAt: '', updatedAt: '' };
        expect(isSelectableProjectForTaskAssignment(projects[0])).toBe(true);
        expect(isSelectableProjectForTaskAssignment(projects[4])).toBe(false);
        expect(isSelectableProjectForTaskAssignment(archivedProject)).toBe(false);
        expect(isSelectableProjectForTaskAssignment(completedProject)).toBe(false);
    });

    it('filters projects by tag', () => {
        const tagged = getProjectsByTag(projects, 't1');
        expect(tagged.map((p) => p.id)).toEqual(['p1', 'p3']);
    });
});
