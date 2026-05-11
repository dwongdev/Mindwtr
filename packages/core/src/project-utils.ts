import type { Project, Task } from './types';

export function isSelectableProjectForTaskAssignment(project: Project): boolean {
    const status = String(project.status);
    return !project.deletedAt && status !== 'archived' && status !== 'completed';
}

export function isTaskInActiveProject(
    task: Task,
    projectLookup: Map<string, Project> | Record<string, Project>
): boolean {
    if (!task.projectId) return true;
    const project =
        projectLookup instanceof Map
            ? projectLookup.get(task.projectId)
            : projectLookup[task.projectId];
    if (!project) return true;
    if (project.deletedAt) return false;
    return project.status === 'active' || project.isFocused === true;
}

export function projectHasNextAction(project: Project, tasks: Task[]): boolean {
    return tasks.some(t =>
        t.projectId === project.id &&
        !t.deletedAt &&
        t.status === 'next'
    );
}

export function filterProjectsNeedingNextAction(projects: Project[], tasks: Task[]): Project[] {
    return projects.filter(p => p.status === 'active' && !p.deletedAt && !projectHasNextAction(p, tasks));
}

export function getProjectsByArea(projects: Project[], areaId: string): Project[] {
    return projects
        .filter(p => !p.deletedAt && p.areaId === areaId)
        .sort((a, b) => a.title.localeCompare(b.title));
}

export function filterProjectsBySelectedArea(projects: Project[], selectedAreaId?: string): Project[] {
    return projects.filter((project) => {
        if (!isSelectableProjectForTaskAssignment(project)) return false;
        if (!selectedAreaId) return true;
        return project.areaId === selectedAreaId;
    });
}

export const getProjectsByTag = (projects: Project[], tagId: string): Project[] => {
    return projects
        .filter(p => !p.deletedAt && (p.tagIds || []).includes(tagId))
        .sort((a, b) => a.title.localeCompare(b.title));
};
