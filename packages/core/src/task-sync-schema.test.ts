import { describe, expect, it } from 'vitest';
import {
    mapSqliteTaskRow,
    TASK_SQLITE_COLUMNS,
    TASK_SQLITE_MIGRATION_COLUMNS,
    TASK_UPSERT_UPDATE_CLAUSE,
    taskToSqliteRow,
} from './sqlite-adapter';
import { normalizeTaskForSyncMerge } from './sync-normalization';
import { normalizeTaskForContentComparison, TASK_CONTENT_COMPARISON_EXCLUDED_KEYS } from './sync-signatures';
import {
    TASK_SYNC_FIELD_SCHEMA,
    TASK_SYNC_SCHEMA_FIXTURE,
    TASK_SYNC_SCHEMA_VERSION,
} from './task-sync-schema';

// Frozen snapshots of the hand-written literals these lists replaced (as of the
// generative-schema refactor, 2026-07-20). These arrays must NEVER be updated to
// match a code change — they exist to prove today's derived output is byte-identical
// to yesterday's literal. A legitimate schema change (a new synced field) should grow
// TASK_SYNC_FIELD_SCHEMA and leave these arrays alone; the mismatch this then produces
// here is expected and this block should be deleted, not "fixed", once that lands.
const PRE_REFACTOR_TASK_SQLITE_COLUMNS = [
    'id', 'title', 'status', 'priority', 'energyLevel', 'assignedTo', 'taskMode', 'startTime',
    'relativeStartOffset', 'dueDate', 'recurrence', 'showFutureRecurrence', 'pushCount',
    'repeatReminderMinutes', 'tags', 'contexts', 'checklist', 'description', 'textDirection',
    'attachments', 'location', 'projectId', 'sectionId', 'areaId', 'orderNum', 'boardOrder',
    'focusOrder', 'isFocusedToday', 'timeEstimate', 'timeSpentMinutes', 'suppressMindwtrReminders',
    'reviewAt', 'completedAt', 'statusBeforeProjectArchive', 'completedAtBeforeProjectArchive',
    'isFocusedTodayBeforeProjectArchive', 'projectArchivedAt', 'rev', 'revBy', 'createdAt',
    'updatedAt', 'deletedAt', 'purgedAt',
];

const PRE_REFACTOR_TASK_UPSERT_UPDATE_CLAUSE = `title=excluded.title,
status=excluded.status,
priority=excluded.priority,
energyLevel=excluded.energyLevel,
assignedTo=excluded.assignedTo,
taskMode=excluded.taskMode,
startTime=excluded.startTime,
relativeStartOffset=excluded.relativeStartOffset,
dueDate=excluded.dueDate,
recurrence=excluded.recurrence,
showFutureRecurrence=excluded.showFutureRecurrence,
pushCount=excluded.pushCount,
repeatReminderMinutes=excluded.repeatReminderMinutes,
tags=excluded.tags,
contexts=excluded.contexts,
checklist=excluded.checklist,
description=excluded.description,
textDirection=excluded.textDirection,
attachments=excluded.attachments,
location=excluded.location,
projectId=excluded.projectId,
sectionId=excluded.sectionId,
areaId=excluded.areaId,
orderNum=excluded.orderNum,
boardOrder=excluded.boardOrder,
focusOrder=excluded.focusOrder,
isFocusedToday=excluded.isFocusedToday,
timeEstimate=excluded.timeEstimate,
timeSpentMinutes=excluded.timeSpentMinutes,
suppressMindwtrReminders=excluded.suppressMindwtrReminders,
reviewAt=excluded.reviewAt,
completedAt=excluded.completedAt,
statusBeforeProjectArchive=excluded.statusBeforeProjectArchive,
completedAtBeforeProjectArchive=excluded.completedAtBeforeProjectArchive,
isFocusedTodayBeforeProjectArchive=excluded.isFocusedTodayBeforeProjectArchive,
projectArchivedAt=excluded.projectArchivedAt,
rev=excluded.rev,
revBy=excluded.revBy,
createdAt=excluded.createdAt,
updatedAt=excluded.updatedAt,
deletedAt=excluded.deletedAt,
purgedAt=excluded.purgedAt
WHERE tasks.rev IS NULL OR tasks.rev <= excluded.rev`;

const PRE_REFACTOR_ENSURE_TASK_COLUMNS_NAMES = [
    'priority', 'energyLevel', 'assignedTo', 'taskMode', 'startTime', 'relativeStartOffset',
    'dueDate', 'recurrence', 'showFutureRecurrence', 'pushCount', 'repeatReminderMinutes', 'tags',
    'contexts', 'checklist', 'description', 'textDirection', 'attachments', 'location', 'projectId',
    'sectionId', 'areaId', 'orderNum', 'boardOrder', 'focusOrder', 'isFocusedToday', 'timeEstimate',
    'timeSpentMinutes', 'suppressMindwtrReminders', 'reviewAt', 'completedAt',
    'statusBeforeProjectArchive', 'completedAtBeforeProjectArchive',
    'isFocusedTodayBeforeProjectArchive', 'projectArchivedAt', 'rev', 'revBy', 'createdAt',
    'updatedAt', 'deletedAt', 'purgedAt',
];

const PRE_REFACTOR_ENSURE_TASK_COLUMNS_SQL = [
    'ALTER TABLE tasks ADD COLUMN priority TEXT',
    'ALTER TABLE tasks ADD COLUMN energyLevel TEXT',
    'ALTER TABLE tasks ADD COLUMN assignedTo TEXT',
    'ALTER TABLE tasks ADD COLUMN taskMode TEXT',
    'ALTER TABLE tasks ADD COLUMN startTime TEXT',
    'ALTER TABLE tasks ADD COLUMN relativeStartOffset TEXT',
    'ALTER TABLE tasks ADD COLUMN dueDate TEXT',
    'ALTER TABLE tasks ADD COLUMN recurrence TEXT',
    'ALTER TABLE tasks ADD COLUMN showFutureRecurrence INTEGER',
    'ALTER TABLE tasks ADD COLUMN pushCount INTEGER',
    'ALTER TABLE tasks ADD COLUMN repeatReminderMinutes INTEGER',
    'ALTER TABLE tasks ADD COLUMN tags TEXT',
    'ALTER TABLE tasks ADD COLUMN contexts TEXT',
    'ALTER TABLE tasks ADD COLUMN checklist TEXT',
    'ALTER TABLE tasks ADD COLUMN description TEXT',
    'ALTER TABLE tasks ADD COLUMN textDirection TEXT',
    'ALTER TABLE tasks ADD COLUMN attachments TEXT',
    'ALTER TABLE tasks ADD COLUMN location TEXT',
    'ALTER TABLE tasks ADD COLUMN projectId TEXT',
    'ALTER TABLE tasks ADD COLUMN sectionId TEXT',
    'ALTER TABLE tasks ADD COLUMN areaId TEXT',
    'ALTER TABLE tasks ADD COLUMN orderNum INTEGER',
    'ALTER TABLE tasks ADD COLUMN boardOrder INTEGER',
    'ALTER TABLE tasks ADD COLUMN focusOrder INTEGER',
    'ALTER TABLE tasks ADD COLUMN isFocusedToday INTEGER',
    'ALTER TABLE tasks ADD COLUMN timeEstimate TEXT',
    'ALTER TABLE tasks ADD COLUMN timeSpentMinutes INTEGER',
    'ALTER TABLE tasks ADD COLUMN suppressMindwtrReminders INTEGER',
    'ALTER TABLE tasks ADD COLUMN reviewAt TEXT',
    'ALTER TABLE tasks ADD COLUMN completedAt TEXT',
    'ALTER TABLE tasks ADD COLUMN statusBeforeProjectArchive TEXT',
    'ALTER TABLE tasks ADD COLUMN completedAtBeforeProjectArchive TEXT',
    'ALTER TABLE tasks ADD COLUMN isFocusedTodayBeforeProjectArchive INTEGER',
    'ALTER TABLE tasks ADD COLUMN projectArchivedAt TEXT',
    'ALTER TABLE tasks ADD COLUMN rev INTEGER',
    'ALTER TABLE tasks ADD COLUMN revBy TEXT',
    'ALTER TABLE tasks ADD COLUMN createdAt TEXT',
    'ALTER TABLE tasks ADD COLUMN updatedAt TEXT',
    'ALTER TABLE tasks ADD COLUMN deletedAt TEXT',
    'ALTER TABLE tasks ADD COLUMN purgedAt TEXT',
];

const PRE_REFACTOR_TASK_CONTENT_COMPARISON_EXCLUDED_KEYS = [
    'rev', 'revBy', 'createdAt', 'updatedAt', 'purgedAt', 'order', 'orderNum', 'boardOrder',
    'focusOrder', 'statusBeforeProjectArchive', 'completedAtBeforeProjectArchive',
    'isFocusedTodayBeforeProjectArchive', 'projectArchivedAt',
];

const sorted = (values: Iterable<string>): string[] => Array.from(values).sort();

describe('Task sync schema contract', () => {
    const fieldNames = TASK_SYNC_FIELD_SCHEMA.map((field) => field.name);

    it('has one unique, versioned entry and fixture value for every Task field', () => {
        expect(new Set(fieldNames).size).toBe(fieldNames.length);
        expect(Object.keys(TASK_SYNC_SCHEMA_FIXTURE).sort()).toEqual(sorted(fieldNames));
        expect(TASK_SYNC_SCHEMA_VERSION).toBeGreaterThan(0);
        for (const field of TASK_SYNC_FIELD_SCHEMA) {
            expect(field.sinceVersion).toBeGreaterThan(0);
            expect(field.sinceVersion).toBeLessThanOrEqual(TASK_SYNC_SCHEMA_VERSION);
        }
    });

    it('keeps sync normalization exhaustive', () => {
        const normalized = normalizeTaskForSyncMerge(
            TASK_SYNC_SCHEMA_FIXTURE,
            '2026-07-14T12:00:00.000Z',
        );

        expect(Object.keys(normalized).sort()).toEqual(sorted(fieldNames));
    });

    it('keeps content-signature fields aligned with their declared semantics', () => {
        const comparable = normalizeTaskForContentComparison(TASK_SYNC_SCHEMA_FIXTURE);
        const expected = TASK_SYNC_FIELD_SCHEMA
            .filter((field) => field.signature === 'content')
            .map((field) => field.name);

        expect(Object.keys(comparable).sort()).toEqual(sorted(expected));
    });

    it('keeps SQLite columns, serialization, and row mapping exhaustive', () => {
        const expectedColumns = new Set(
            TASK_SYNC_FIELD_SCHEMA
                .map((field) => field.sqliteColumn)
                .filter((column): column is string => column !== null),
        );
        expect(sorted(TASK_SQLITE_COLUMNS)).toEqual(sorted(expectedColumns));

        const row = taskToSqliteRow(TASK_SYNC_SCHEMA_FIXTURE);
        expect(row).toHaveLength(TASK_SQLITE_COLUMNS.length);
        const rowRecord = Object.fromEntries(
            TASK_SQLITE_COLUMNS.map((column, index) => [column, row[index]]),
        );
        for (const column of expectedColumns) {
            expect(rowRecord[column], column).not.toBeNull();
            expect(rowRecord[column], column).not.toBeUndefined();
        }

        const mapped = mapSqliteTaskRow(rowRecord);
        expect(Object.keys(mapped).sort()).toEqual(sorted(fieldNames));
    });

    // Snapshot-equality guards: TASK_SQLITE_COLUMNS, TASK_UPSERT_UPDATE_CLAUSE,
    // TASK_SQLITE_MIGRATION_COLUMNS, and TASK_CONTENT_COMPARISON_EXCLUDED_KEYS are all
    // generated from TASK_SYNC_FIELD_SCHEMA now instead of hand-maintained literals. These
    // compare the generated output byte-for-byte against a frozen copy of the pre-refactor
    // literals to prove the refactor changed nothing observable.
    it('derives TASK_SQLITE_COLUMNS identical to the pre-refactor literal, in order', () => {
        expect(TASK_SQLITE_COLUMNS).toEqual(PRE_REFACTOR_TASK_SQLITE_COLUMNS);
    });

    it('derives TASK_UPSERT_UPDATE_CLAUSE identical to the pre-refactor literal', () => {
        expect(TASK_UPSERT_UPDATE_CLAUSE).toBe(PRE_REFACTOR_TASK_UPSERT_UPDATE_CLAUSE);
    });

    it('derives the ensureTaskColumns migration list identical to the pre-refactor literal, in order', () => {
        expect(TASK_SQLITE_MIGRATION_COLUMNS.map((entry) => entry.name)).toEqual(PRE_REFACTOR_ENSURE_TASK_COLUMNS_NAMES);
        expect(TASK_SQLITE_MIGRATION_COLUMNS.map((entry) => entry.sql)).toEqual(PRE_REFACTOR_ENSURE_TASK_COLUMNS_SQL);
    });

    it('keeps the content-comparison excluded-key set aligned with the schema signature field', () => {
        expect(sorted(TASK_CONTENT_COMPARISON_EXCLUDED_KEYS)).toEqual(sorted(PRE_REFACTOR_TASK_CONTENT_COMPARISON_EXCLUDED_KEYS));

        const expectedFromSchema = TASK_SYNC_FIELD_SCHEMA
            .filter((field) => field.signature !== 'content')
            .map((field) => field.name);
        expect(sorted(TASK_CONTENT_COMPARISON_EXCLUDED_KEYS)).toEqual(sorted(expectedFromSchema));
    });
});
