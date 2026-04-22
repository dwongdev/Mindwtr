import { describe, expect, it } from 'vitest';

import { applyOmniFocusImport, parseOmniFocusImportSource } from './omnifocus-import';
import { mockAppData } from './sync-test-utils';
import type { Project } from './types';

const encodeUtf16Le = (value: string): Uint8Array => {
    const buffer = new Uint8Array(2 + (value.length * 2));
    buffer[0] = 0xff;
    buffer[1] = 0xfe;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        buffer[2 + index * 2] = code & 0xff;
        buffer[3 + index * 2] = code >> 8;
    }
    return buffer;
};

describe('omnifocus import', () => {
    it('parses OmniFocus CSV rows into projects and tasks, preserving unmapped fields in notes', () => {
        const csv = [
            'Task ID,Type,Name,Status,Project,Context,Start Date,Planned Date,Due Date,Completion Date,Duration,Flagged,Notes,Tags',
            '1,Project,House Renovation,Active,,,,,2026-05-10,,,0,Project support note,Home',
            '2,Action,Buy paint,Available,House Renovation,Errands,2026-05-01,2026-05-03,2026-05-06,,45m,1,Eggshell white,Deep Work',
            '3,Action,Inbox follow-up,Completed,,Calls,"May 7, 2026","May 8, 2026","May 9, 2026","May 10, 2026",,0,Call contractor,Phone',
            '4,Action Group,Pack tools,Available,House Renovation,,,,,,0,,Prep list,Workshop',
        ].join('\n');

        const result = parseOmniFocusImportSource({
            fileName: 'OmniFocus Export.csv',
            text: csv,
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.preview).toMatchObject({
            fileName: 'OmniFocus Export.csv',
            projectCount: 1,
            taskCount: 3,
            standaloneTaskCount: 1,
            projects: [{ name: 'House Renovation', taskCount: 2 }],
        });
        expect(result.warnings).toContain('4 OmniFocus dates could not be mapped directly and were preserved in notes.');

        const parsed = result.parsedData;
        expect(parsed).not.toBeNull();
        expect(parsed?.projects[0]).toMatchObject({
            name: 'House Renovation',
            status: 'active',
            dueDate: '2026-05-10',
            tagIds: ['#home'],
        });
        expect(parsed?.projects[0]?.supportNotes).toContain('Project support note');

        const projectTask = parsed?.tasks.find((task) => task.title === 'Buy paint');
        expect(projectTask).toMatchObject({
            projectSourceKey: 'house renovation',
            contexts: ['@Errands'],
            tags: ['#deep work'],
            startTime: '2026-05-01',
            dueDate: '2026-05-06',
            priority: 'high',
            status: 'inbox',
        });
        expect(projectTask?.description).toContain('Eggshell white');
        expect(projectTask?.description).toContain('Planned date in OmniFocus: 2026-05-03');
        expect(projectTask?.description).toContain('Estimated duration in OmniFocus: 45m');

        const completedStandaloneTask = parsed?.tasks.find((task) => task.title === 'Inbox follow-up');
        expect(completedStandaloneTask).toMatchObject({
            status: 'done',
            projectSourceKey: undefined,
            contexts: ['@Calls'],
            tags: ['#phone'],
        });
        expect(completedStandaloneTask?.description).toContain('Original OmniFocus start date: May 7, 2026');
        expect(completedStandaloneTask?.description).toContain('Original OmniFocus planned date: May 8, 2026');
        expect(completedStandaloneTask?.description).toContain('Original OmniFocus due date: May 9, 2026');
        expect(completedStandaloneTask?.description).toContain('Original OmniFocus completion date: May 10, 2026');
    });

    it('parses UTF-16 OmniFocus CSV files', () => {
        const csv = [
            'Task ID,Type,Name,Status,Project,Context,Start Date,Planned Date,Due Date,Completion Date,Duration,Flagged,Notes,Tags',
            '1,Action,Sample inbox task,Available,,,,,,,,0,,',
        ].join('\n');

        const result = parseOmniFocusImportSource({
            fileName: 'OmniFocus UTF16.csv',
            bytes: encodeUtf16Le(csv),
        });

        expect(result.valid).toBe(true);
        expect(result.preview).toMatchObject({
            projectCount: 0,
            taskCount: 1,
            standaloneTaskCount: 1,
        });
        expect(result.parsedData?.tasks[0]).toMatchObject({
            title: 'Sample inbox task',
            status: 'inbox',
        });
    });

    it('imports parsed OmniFocus data into projects and standalone inbox tasks', () => {
        const parseResult = parseOmniFocusImportSource({
            fileName: 'OmniFocus Export.csv',
            text: [
                'Task ID,Type,Name,Status,Project,Context,Start Date,Planned Date,Due Date,Completion Date,Duration,Flagged,Notes,Tags',
                '1,Project,House Renovation,Active,,,,,2026-05-10,,,0,Project support note,Home',
                '2,Action,Buy paint,Available,House Renovation,Errands,2026-05-01,,2026-05-06,,45m,1,Eggshell white,Deep Work',
                '3,Action,Inbox follow-up,Available,,Calls,,,,,,0,Call contractor,Phone',
            ].join('\n'),
        });
        if (!parseResult.valid || !parseResult.parsedData) {
            throw new Error('Expected OmniFocus sample export to parse.');
        }

        const existingProject: Project = {
            id: 'project-existing',
            title: 'House Renovation',
            status: 'active',
            color: '#111827',
            order: 0,
            tagIds: [],
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
        };

        const result = applyOmniFocusImport(
            mockAppData([], [existingProject], []),
            parseResult.parsedData,
            { now: '2026-05-02T12:00:00.000Z' }
        );

        expect(result.importedProjectCount).toBe(1);
        expect(result.importedTaskCount).toBe(2);
        expect(result.importedStandaloneTaskCount).toBe(1);
        expect(result.warnings).toContain('Imported project "House Renovation" was renamed to "House Renovation (OmniFocus)" to avoid a title conflict.');
        expect(result.data.settings.deviceId).toBeTruthy();

        const importedProject = result.data.projects.find((project) => project.id !== existingProject.id);
        expect(importedProject).toMatchObject({
            title: 'House Renovation (OmniFocus)',
            status: 'active',
            dueDate: '2026-05-10',
            supportNotes: 'Project support note',
            tagIds: ['#home'],
        });

        const projectTask = result.data.tasks.find((task) => task.title === 'Buy paint');
        expect(projectTask).toMatchObject({
            projectId: importedProject?.id,
            status: 'inbox',
            priority: 'high',
            tags: ['#deep work'],
            contexts: ['@Errands'],
            dueDate: '2026-05-06',
            startTime: '2026-05-01',
        });
        expect(projectTask?.description).toContain('Eggshell white');

        const standaloneTask = result.data.tasks.find((task) => task.title === 'Inbox follow-up');
        expect(standaloneTask).toMatchObject({
            status: 'inbox',
            tags: ['#phone'],
            contexts: ['@Calls'],
            description: 'Call contractor',
        });
    });
});
