import { describe, expect, it } from 'vitest';

import { createBackupFileName, serializeBackupData, validateBackupJson } from './backup-transfer';
import type { AppData } from './types';

const buildAppData = (): AppData => {
    const now = '2026-03-30T12:00:00.000Z';
    return {
        tasks: [
            {
                id: 'task-1',
                title: 'Task',
                status: 'inbox',
                tags: [],
                contexts: [],
                createdAt: now,
                updatedAt: now,
            },
        ],
        projects: [
            {
                id: 'project-1',
                title: 'Project',
                status: 'active',
                color: '#94a3b8',
                order: 0,
                tagIds: [],
                createdAt: now,
                updatedAt: now,
            },
        ],
        sections: [],
        areas: [],
        settings: {},
    };
};

describe('backup transfer', () => {
    it('validates a serialized backup and derives metadata from the file name', () => {
        const data = buildAppData();
        const fileName = createBackupFileName(new Date('2026-03-30T12:34:56.789Z'));
        const result = validateBackupJson(serializeBackupData(data), { fileName });

        expect(result.valid).toBe(true);
        expect(result.data).toEqual(data);
        expect(result.metadata?.taskCount).toBe(1);
        expect(result.metadata?.projectCount).toBe(1);
        expect(result.metadata?.backupAt).toBe('2026-03-30T12:34:56.789Z');
        expect(result.warnings).toEqual([]);
    });

    it('rejects non-Mindwtr JSON payloads', () => {
        const result = validateBackupJson(JSON.stringify({
            tasks: {},
            projects: [],
            sections: [],
            areas: [],
            settings: {},
        }), {
            fileName: 'package.json',
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('tasks');
    });
});
