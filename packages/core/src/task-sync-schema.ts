import schemaFixture from './task-sync-schema.fixture.json';
import type { Task } from './types';

export type TaskFieldSyncSemantics =
    | 'identity'
    | 'content'
    | 'archive-metadata'
    | 'revision-metadata'
    | 'tombstone'
    | 'order'
    | 'legacy-alias';

export type TaskFieldNullability = 'required' | 'optional' | 'optional-nullable';
export type TaskFieldSignatureSemantics = 'content' | 'ignored' | 'opaque';
export type TaskCloudWriteSemantics = 'create-patch' | 'patch' | 'managed';
export type TaskCloudKitFieldKind =
    | 'string'
    | 'date'
    | 'json-string'
    | 'boolean'
    | 'integer'
    | 'string-array';

export type TaskCloudKitFieldSpec = {
    key: string;
    kind: TaskCloudKitFieldKind;
};

export type TaskSqliteColumnType = 'TEXT' | 'INTEGER';

export type TaskSyncFieldSpec = {
    name: keyof Task;
    sync: TaskFieldSyncSemantics;
    nullability: TaskFieldNullability;
    sinceVersion: number;
    signature: TaskFieldSignatureSemantics;
    sqliteColumn: string | null;
    cloudKit: TaskCloudKitFieldSpec | null;
    cloudWrite: TaskCloudWriteSemantics;
    /**
     * Position of `sqliteColumn` in TASK_SQLITE_COLUMNS / the upsert clause /
     * the ensureTaskColumns migration list. Required whenever sqliteColumn is
     * set (multiple fields, e.g. `order`/`orderNum`, may share a column and
     * therefore the same position — the generator dedupes by column name).
     * SQL column order is load-bearing for row-building call sites that zip
     * TASK_SQLITE_COLUMNS with taskToSqliteRow's positional values.
     */
    sqliteOrder: number | null;
    /** SQL type for the ensureTaskColumns ALTER TABLE migration. Null for the
     *  three base columns (id/title/status) that ship in the CREATE TABLE
     *  itself and therefore never appear in the migration list. */
    sqliteType: TaskSqliteColumnType | null;
};

type TaskSyncSchemaFixture = {
    schemaVersion: number;
    sinceVersionPolicy: string;
    fields: TaskSyncFieldSpec[];
    fixture: Task;
};

const schema = schemaFixture as TaskSyncSchemaFixture;

export const TASK_SYNC_SCHEMA_VERSION = schema.schemaVersion;
export const TASK_SYNC_SCHEMA_VERSION_POLICY = schema.sinceVersionPolicy;
export const TASK_SYNC_FIELD_SCHEMA: readonly TaskSyncFieldSpec[] = schema.fields;
export const TASK_SYNC_SCHEMA_FIXTURE: Task = schema.fixture;

// Generated SQLite column list + ensureTaskColumns migration list, both derived from
// TASK_SYNC_FIELD_SCHEMA above. This lives here (not in sqlite-adapter.ts, which
// re-exports TASK_SQLITE_COLUMNS for its existing consumers and builds
// TASK_UPSERT_UPDATE_CLAUSE from it) because scripts/check-synced-field-parity.ts imports
// these two directly, and that script's "native-schema" CI job runs `bun run schema:check`
// on a fresh macOS checkout with no `bun install` step — nothing it imports may pull in a
// real npm dependency. sqlite-adapter.ts fails that bar (it transitively imports
// `date-fns` via recurrence.ts/saved-filters.ts); this file and its fixture JSON don't.
//
// Column ORDER here is load-bearing: sqlite-adapter.ts's taskToSqliteRow returns values
// positionally zipped against TASK_SQLITE_COLUMNS, and the upsert update clause derives
// from it too. Each field's `sqliteOrder` pins its position; fields that share a
// `sqliteColumn` (`order`/`orderNum` both write the same `orderNum` column) collapse to
// one entry, keeping the position of whichever field is declared first in the schema.
type TaskSqliteColumnEntry = {
    column: string;
    order: number;
    sqlType: TaskSqliteColumnType | null;
};

function deriveTaskSqliteColumnEntries(): TaskSqliteColumnEntry[] {
    const seen = new Set<string>();
    const entries: TaskSqliteColumnEntry[] = [];
    for (const field of TASK_SYNC_FIELD_SCHEMA) {
        if (field.sqliteColumn === null || seen.has(field.sqliteColumn)) continue;
        if (field.sqliteOrder === null) {
            throw new Error(`task-sync-schema: "${field.name}" declares sqliteColumn without sqliteOrder`);
        }
        seen.add(field.sqliteColumn);
        entries.push({ column: field.sqliteColumn, order: field.sqliteOrder, sqlType: field.sqliteType });
    }
    return entries.sort((a, b) => a.order - b.order);
}

const TASK_SQLITE_COLUMN_ENTRIES: TaskSqliteColumnEntry[] = deriveTaskSqliteColumnEntries();

export const TASK_SQLITE_COLUMNS: readonly string[] = TASK_SQLITE_COLUMN_ENTRIES.map((entry) => entry.column);

// The migration list ensureTaskColumns() runs at startup: every synced column
// except the three (id/title/status) that ship in the base CREATE TABLE.
export const TASK_SQLITE_MIGRATION_COLUMNS: readonly { name: string; sql: string }[] = TASK_SQLITE_COLUMN_ENTRIES
    .filter((entry) => entry.sqlType !== null)
    .map((entry) => ({ name: entry.column, sql: `ALTER TABLE tasks ADD COLUMN ${entry.column} ${entry.sqlType}` }));
