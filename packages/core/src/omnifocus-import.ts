import { DEFAULT_PROJECT_COLOR } from './color-constants';
import { safeParseDate } from './date';
import { ensureDeviceId, normalizeTagId } from './store-helpers';
import type { AppData, Project, Task, TaskPriority, TaskStatus } from './types';
import { generateUUID as uuidv4 } from './uuid';

const OMNIFOCUS_REQUIRED_COLUMNS = ['TYPE', 'NAME'];
const OMNIFOCUS_DELIMITER_FALLBACK = ',';
const OMNIFOCUS_PROJECT_FALLBACK = 'OmniFocus Import';
const OMNIFOCUS_IMPORT_SUFFIX = ' (OmniFocus)';

type OmniFocusFileInput = {
    bytes?: ArrayBuffer | Uint8Array | null;
    fileName: string;
    text?: string | null;
};

type OmniFocusWarningCounters = {
    emptyExports: number;
    unknownTypes: number;
    unparsedDateFields: number;
};

type ParsedOmniFocusRow = {
    completionDate?: string;
    contextNames: string[];
    dueDate?: string;
    duration?: string;
    flagged: boolean;
    lineNumber: number;
    name: string;
    notes?: string;
    plannedDate?: string;
    projectName?: string;
    startDate?: string;
    statusText?: string;
    tagNames: string[];
    type: 'project' | 'task';
};

export type ParsedOmniFocusProject = {
    dueDate?: string;
    name: string;
    order: number;
    sourceKey: string;
    status: Project['status'];
    supportNotes?: string;
    tagIds: string[];
};

export type ParsedOmniFocusTask = {
    completedAt?: string;
    contexts: string[];
    description?: string;
    dueDate?: string;
    order: number;
    priority?: TaskPriority;
    projectSourceKey?: string;
    startTime?: string;
    status: TaskStatus;
    tags: string[];
    title: string;
};

export type ParsedOmniFocusImportData = {
    projects: ParsedOmniFocusProject[];
    tasks: ParsedOmniFocusTask[];
    warnings: string[];
};

export type OmniFocusImportProjectPreview = {
    name: string;
    taskCount: number;
};

export type OmniFocusImportPreview = {
    fileName: string;
    projectCount: number;
    projects: OmniFocusImportProjectPreview[];
    standaloneTaskCount: number;
    taskCount: number;
    warnings: string[];
};

export type OmniFocusImportParseResult = {
    errors: string[];
    parsedData: ParsedOmniFocusImportData | null;
    preview: OmniFocusImportPreview | null;
    valid: boolean;
    warnings: string[];
};

export type OmniFocusImportExecutionResult = {
    data: AppData;
    importedProjectCount: number;
    importedStandaloneTaskCount: number;
    importedTaskCount: number;
    warnings: string[];
};

const createWarningCounters = (): OmniFocusWarningCounters => ({
    emptyExports: 0,
    unknownTypes: 0,
    unparsedDateFields: 0,
});

const appendWarning = (warnings: string[], count: number, singular: string, plural = singular): void => {
    if (count <= 0) return;
    warnings.push(count === 1 ? singular : plural.replace('{count}', String(count)));
};

const buildWarnings = (counters: OmniFocusWarningCounters): string[] => {
    const warnings: string[] = [];
    appendWarning(
        warnings,
        counters.unknownTypes,
        '1 OmniFocus row type was not recognized and was imported as a task.',
        '{count} OmniFocus row types were not recognized and were imported as tasks.'
    );
    appendWarning(
        warnings,
        counters.unparsedDateFields,
        '1 OmniFocus date could not be mapped directly and was preserved in notes.',
        '{count} OmniFocus dates could not be mapped directly and were preserved in notes.'
    );
    appendWarning(
        warnings,
        counters.emptyExports,
        '1 OmniFocus export contained no importable tasks or projects.',
        '{count} OmniFocus exports contained no importable tasks or projects.'
    );
    return warnings;
};

const basename = (value: string): string => {
    const parts = String(value || '').split(/[\\/]/u);
    return parts[parts.length - 1] || value;
};

const sanitizeCsvText = (raw: string): string => String(raw || '').replace(/^\uFEFF/u, '');

const decodeUtf16Be = (bytes: Uint8Array): string => {
    const swapped = new Uint8Array(bytes.length - (bytes.length % 2));
    for (let index = 0; index < swapped.length; index += 2) {
        swapped[index] = bytes[index + 1];
        swapped[index + 1] = bytes[index];
    }
    return new TextDecoder('utf-16le', { fatal: false }).decode(swapped);
};

const decodeOmniFocusBytes = (bytes: Uint8Array): string => {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return decodeUtf16Be(bytes.slice(2));
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
};

const toUint8Array = (value?: ArrayBuffer | Uint8Array | null): Uint8Array | null => {
    if (!value) return null;
    return value instanceof Uint8Array ? value : new Uint8Array(value);
};

const detectDelimiter = (text: string): string => {
    const firstLine = sanitizeCsvText(text)
        .split(/\r?\n/u)
        .find((line) => line.trim().length > 0);
    if (!firstLine) return OMNIFOCUS_DELIMITER_FALLBACK;
    const commaCount = (firstLine.match(/,/gu) || []).length;
    const semicolonCount = (firstLine.match(/;/gu) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
};

const parseCsvRows = (text: string, delimiter: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];
        if (inQuotes) {
            if (char === '"') {
                if (next === '"') {
                    currentCell += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }
        if (char === delimiter) {
            currentRow.push(currentCell);
            currentCell = '';
            continue;
        }
        if (char === '\r' || char === '\n') {
            if (char === '\r' && next === '\n') {
                index += 1;
            }
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
            continue;
        }
        currentCell += char;
    }

    currentRow.push(currentCell);
    if (currentRow.length > 1 || currentRow[0] !== '' || rows.length === 0) {
        rows.push(currentRow);
    }
    return rows.filter((row) => row.some((cell) => cell.length > 0));
};

const normalizeHeaderCell = (value: string): string => value.trim().toUpperCase();

const buildHeaderIndex = (headerRow: string[]): Map<string, number> => {
    const index = new Map<string, number>();
    headerRow.forEach((cell, cellIndex) => {
        const normalized = normalizeHeaderCell(cell);
        if (normalized && !index.has(normalized)) {
            index.set(normalized, cellIndex);
        }
    });
    return index;
};

const getCell = (row: string[], headerIndex: Map<string, number>, key: string): string => {
    const index = headerIndex.get(key);
    if (index === undefined) return '';
    return String(row[index] ?? '').trim();
};

const normalizeContextName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const splitTokenList = (value: string): string[] =>
    value
        .split(/[;,]/u)
        .map((entry) => entry.trim())
        .filter(Boolean);

const dedupeCaseInsensitive = (values: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return;
        const normalized = trimmed.toLowerCase();
        if (seen.has(normalized)) return;
        seen.add(normalized);
        result.push(trimmed);
    });
    return result;
};

const normalizeTags = (value: string): string[] =>
    dedupeCaseInsensitive(splitTokenList(value).map((tag) => normalizeTagId(tag)).filter(Boolean));

const normalizeContexts = (value: string): string[] =>
    dedupeCaseInsensitive(splitTokenList(value).map((context) => normalizeContextName(context)).filter(Boolean) as string[]);

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

const formatLocalDate = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatLocalDateTime = (date: Date): string =>
    `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

const normalizeMappedDate = (value: string): { rawText?: string; value?: string } => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return {};
    const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})$/u.exec(trimmed);
    if (dateOnlyMatch) {
        return { value: dateOnlyMatch[1] };
    }
    const dateTimeMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/u.exec(trimmed);
    if (dateTimeMatch) {
        return { value: `${dateTimeMatch[1]}T${dateTimeMatch[2]}` };
    }
    const parsed = safeParseDate(trimmed);
    if (!parsed) {
        return { rawText: trimmed };
    }
    return {
        value: /(?:\d{1,2}:\d{2}|[ap]\.?m\.?)/iu.test(trimmed)
            ? formatLocalDateTime(parsed)
            : formatLocalDate(parsed),
    };
};

const normalizeProjectKey = (value: string): string => value.trim().toLowerCase();

const parseFlagged = (value: string): boolean => /^(?:1|true|yes|y|flagged)$/iu.test(value.trim());

const parseProjectStatus = (value: string): Project['status'] => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'active';
    if (normalized.includes('drop') || normalized.includes('archive') || normalized.includes('complete') || normalized.includes('done')) {
        return 'archived';
    }
    if (normalized.includes('waiting') || normalized.includes('hold')) return 'waiting';
    if (normalized.includes('someday') || normalized.includes('maybe')) return 'someday';
    return 'active';
};

const parseTaskStatus = (value: string, completionDate?: string): TaskStatus => {
    if (completionDate) return 'done';
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'inbox';
    if (normalized.includes('complete') || normalized.includes('done')) return 'done';
    if (normalized.includes('drop') || normalized.includes('archive')) return 'archived';
    if (normalized.includes('waiting') || normalized.includes('hold')) return 'waiting';
    if (normalized.includes('someday') || normalized.includes('maybe')) return 'someday';
    if (normalized.includes('reference')) return 'reference';
    return 'inbox';
};

const parseRowType = (value: string, counters: OmniFocusWarningCounters): 'project' | 'task' => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'task';
    if (normalized === 'project' || normalized === 'single action list') return 'project';
    if (normalized === 'action' || normalized === 'task' || normalized === 'action group') return 'task';
    counters.unknownTypes += 1;
    return 'task';
};

const joinDescription = (parts: Array<string | undefined>): string | undefined => {
    const normalized = parts.map((part) => String(part || '').trim()).filter(Boolean);
    return normalized.length > 0 ? normalized.join('\n\n') : undefined;
};

const ensureProjectRecord = (
    projectsByKey: Map<string, ParsedOmniFocusProject>,
    projectName: string,
    nextOrder: () => number
): ParsedOmniFocusProject => {
    const normalizedName = projectName.trim();
    const sourceKey = normalizeProjectKey(normalizedName);
    const existing = projectsByKey.get(sourceKey);
    if (existing) return existing;
    const created: ParsedOmniFocusProject = {
        name: normalizedName || OMNIFOCUS_PROJECT_FALLBACK,
        order: nextOrder(),
        sourceKey,
        status: 'active',
        tagIds: [],
    };
    projectsByKey.set(sourceKey, created);
    return created;
};

const mergeProjectSupportNotes = (currentValue: string | undefined, nextValue: string | undefined): string | undefined => {
    const current = String(currentValue || '').trim();
    const next = String(nextValue || '').trim();
    if (!current) return next || undefined;
    if (!next) return current;
    if (current === next) return current;
    return `${current}\n\n${next}`;
};

const parseRows = (csvText: string, counters: OmniFocusWarningCounters): ParsedOmniFocusImportData => {
    const delimiter = detectDelimiter(csvText);
    const rows = parseCsvRows(sanitizeCsvText(csvText), delimiter);
    if (rows.length === 0) {
        counters.emptyExports += 1;
        return { projects: [], tasks: [], warnings: buildWarnings(counters) };
    }

    const headerIndex = buildHeaderIndex(rows[0]);
    const missingRequired = OMNIFOCUS_REQUIRED_COLUMNS.filter((key) => !headerIndex.has(key));
    if (missingRequired.length > 0) {
        throw new Error(`OmniFocus CSV is missing required columns: ${missingRequired.join(', ')}`);
    }

    const parsedRows: ParsedOmniFocusRow[] = [];
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const name = getCell(row, headerIndex, 'NAME');
        const type = parseRowType(getCell(row, headerIndex, 'TYPE'), counters);
        if (!name) continue;

        parsedRows.push({
            type,
            name,
            lineNumber: rowIndex + 1,
            statusText: getCell(row, headerIndex, 'STATUS') || undefined,
            projectName: getCell(row, headerIndex, 'PROJECT') || undefined,
            contextNames: normalizeContexts(getCell(row, headerIndex, 'CONTEXT')),
            startDate: getCell(row, headerIndex, 'START DATE') || undefined,
            plannedDate: getCell(row, headerIndex, 'PLANNED DATE') || undefined,
            dueDate: getCell(row, headerIndex, 'DUE DATE') || undefined,
            completionDate: getCell(row, headerIndex, 'COMPLETION DATE') || undefined,
            duration: getCell(row, headerIndex, 'DURATION') || undefined,
            flagged: parseFlagged(getCell(row, headerIndex, 'FLAGGED')),
            notes: getCell(row, headerIndex, 'NOTES') || undefined,
            tagNames: normalizeTags(getCell(row, headerIndex, 'TAGS')),
        });
    }

    if (parsedRows.length === 0) {
        counters.emptyExports += 1;
        return { projects: [], tasks: [], warnings: buildWarnings(counters) };
    }

    let nextProjectOrder = 0;
    const allocateProjectOrder = (): number => {
        const current = nextProjectOrder;
        nextProjectOrder += 1;
        return current;
    };

    const projectsByKey = new Map<string, ParsedOmniFocusProject>();
    const tasks: ParsedOmniFocusTask[] = [];

    parsedRows.forEach((row, index) => {
        const startMapping = normalizeMappedDate(row.startDate || '');
        const plannedMapping = normalizeMappedDate(row.plannedDate || '');
        const dueMapping = normalizeMappedDate(row.dueDate || '');
        const completionMapping = normalizeMappedDate(row.completionDate || '');
        const rawDateNotes = [
            startMapping.rawText ? `Original OmniFocus start date: ${startMapping.rawText}` : undefined,
            plannedMapping.rawText ? `Original OmniFocus planned date: ${plannedMapping.rawText}` : undefined,
            dueMapping.rawText ? `Original OmniFocus due date: ${dueMapping.rawText}` : undefined,
            completionMapping.rawText ? `Original OmniFocus completion date: ${completionMapping.rawText}` : undefined,
        ].filter(Boolean);
        counters.unparsedDateFields += rawDateNotes.length;

        if (row.type === 'project') {
            const project = ensureProjectRecord(projectsByKey, row.name, allocateProjectOrder);
            project.status = parseProjectStatus(row.statusText || '');
            project.dueDate = dueMapping.value ?? project.dueDate;
            project.supportNotes = mergeProjectSupportNotes(
                project.supportNotes,
                joinDescription([
                    row.notes,
                    plannedMapping.value ? `Planned date in OmniFocus: ${plannedMapping.value}` : undefined,
                    row.duration && row.duration !== '0' ? `Estimated duration in OmniFocus: ${row.duration}` : undefined,
                    ...rawDateNotes,
                ])
            );
            project.tagIds = dedupeCaseInsensitive([...project.tagIds, ...row.tagNames]);
            return;
        }

        const normalizedProjectName = row.projectName?.trim();
        const project = normalizedProjectName
            ? ensureProjectRecord(projectsByKey, normalizedProjectName, allocateProjectOrder)
            : null;
        const description = joinDescription([
            row.notes,
            plannedMapping.value ? `Planned date in OmniFocus: ${plannedMapping.value}` : undefined,
            row.duration && row.duration !== '0' ? `Estimated duration in OmniFocus: ${row.duration}` : undefined,
            ...rawDateNotes,
        ]);
        tasks.push({
            title: row.name,
            order: index,
            projectSourceKey: project?.sourceKey,
            contexts: row.contextNames,
            tags: row.tagNames,
            description,
            startTime: startMapping.value,
            dueDate: dueMapping.value,
            completedAt: completionMapping.value,
            status: parseTaskStatus(row.statusText || '', completionMapping.value),
            priority: row.flagged ? 'high' : undefined,
        });
    });

    return {
        projects: Array.from(projectsByKey.values()).sort((left, right) => left.order - right.order || left.name.localeCompare(right.name)),
        tasks,
        warnings: buildWarnings(counters),
    };
};

const resolveUniqueProjectTitle = (title: string, usedTitles: Set<string>): string => {
    const trimmed = title.trim() || OMNIFOCUS_PROJECT_FALLBACK;
    if (!usedTitles.has(trimmed.toLowerCase())) {
        usedTitles.add(trimmed.toLowerCase());
        return trimmed;
    }

    const base = `${trimmed}${OMNIFOCUS_IMPORT_SUFFIX}`;
    if (!usedTitles.has(base.toLowerCase())) {
        usedTitles.add(base.toLowerCase());
        return base;
    }

    let suffix = 2;
    while (true) {
        const next = `${base} ${suffix}`;
        const normalized = next.toLowerCase();
        if (!usedTitles.has(normalized)) {
            usedTitles.add(normalized);
            return next;
        }
        suffix += 1;
    }
};

const buildPreview = (fileName: string, parsedData: ParsedOmniFocusImportData): OmniFocusImportPreview => {
    const taskCountByProject = new Map<string, number>();
    let standaloneTaskCount = 0;
    parsedData.tasks.forEach((task) => {
        if (task.projectSourceKey) {
            taskCountByProject.set(task.projectSourceKey, (taskCountByProject.get(task.projectSourceKey) ?? 0) + 1);
        } else {
            standaloneTaskCount += 1;
        }
    });
    return {
        fileName,
        projectCount: parsedData.projects.length,
        taskCount: parsedData.tasks.length,
        standaloneTaskCount,
        projects: parsedData.projects.map((project) => ({
            name: project.name,
            taskCount: taskCountByProject.get(project.sourceKey) ?? 0,
        })),
        warnings: parsedData.warnings,
    };
};

export const parseOmniFocusImportSource = (input: OmniFocusFileInput): OmniFocusImportParseResult => {
    const fileName = basename(input.fileName);
    try {
        const bytes = toUint8Array(input.bytes);
        const rawText = input.text ?? (bytes ? decodeOmniFocusBytes(bytes) : '');
        const counters = createWarningCounters();
        const parsedData = parseRows(rawText, counters);
        if (parsedData.projects.length === 0 && parsedData.tasks.length === 0) {
            return {
                valid: false,
                parsedData: null,
                preview: null,
                warnings: parsedData.warnings,
                errors: ['No importable OmniFocus rows were found in the selected file.'],
            };
        }
        return {
            valid: true,
            parsedData,
            preview: buildPreview(fileName, parsedData),
            warnings: parsedData.warnings,
            errors: [],
        };
    } catch (error) {
        return {
            valid: false,
            parsedData: null,
            preview: null,
            warnings: [],
            errors: [
                error instanceof Error && error.message
                    ? error.message
                    : 'Failed to parse the OmniFocus export.',
            ],
        };
    }
};

export const applyOmniFocusImport = (
    currentData: AppData,
    parsedData: ParsedOmniFocusImportData,
    options: { now?: Date | string } = {}
): OmniFocusImportExecutionResult => {
    const resolvedNow = options.now instanceof Date
        ? options.now
        : typeof options.now === 'string' && options.now.trim()
            ? new Date(options.now)
            : new Date();
    const nowIso = Number.isFinite(resolvedNow.getTime()) ? resolvedNow.toISOString() : new Date().toISOString();
    const deviceState = ensureDeviceId(currentData.settings ?? {});
    const settings = deviceState.settings;
    const nextData: AppData = {
        tasks: [...currentData.tasks],
        projects: [...currentData.projects],
        sections: [...currentData.sections],
        areas: [...currentData.areas],
        settings,
    };

    const usedProjectTitles = new Set(
        nextData.projects
            .filter((project) => !project.deletedAt)
            .map((project) => project.title.trim().toLowerCase())
    );
    const warnings = [...parsedData.warnings];
    const projectIdBySourceKey = new Map<string, string>();
    let importedProjectCount = 0;
    let importedTaskCount = 0;
    let importedStandaloneTaskCount = 0;

    parsedData.projects
        .slice()
        .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
        .forEach((parsedProject) => {
            const projectTitle = resolveUniqueProjectTitle(parsedProject.name, usedProjectTitles);
            if (projectTitle !== parsedProject.name) {
                warnings.push(`Imported project "${parsedProject.name}" was renamed to "${projectTitle}" to avoid a title conflict.`);
            }
            const siblingMaxOrder = nextData.projects
                .filter((project) => !project.deletedAt)
                .reduce((max, project) => Math.max(max, Number.isFinite(project.order) ? project.order : -1), -1);
            const project: Project = {
                id: uuidv4(),
                title: projectTitle,
                status: parsedProject.status,
                color: DEFAULT_PROJECT_COLOR,
                order: siblingMaxOrder + 1,
                tagIds: parsedProject.tagIds,
                supportNotes: parsedProject.supportNotes,
                dueDate: parsedProject.dueDate,
                createdAt: nowIso,
                updatedAt: nowIso,
                rev: 1,
                revBy: deviceState.deviceId,
            };
            nextData.projects.push(project);
            projectIdBySourceKey.set(parsedProject.sourceKey, project.id);
            importedProjectCount += 1;
        });

    const nextTaskOrderByBucket = new Map<string, number>();
    const getTaskBucketKey = (projectId?: string): string => (projectId ? `project:${projectId}` : 'inbox');
    const allocateTaskOrder = (projectId?: string): number => {
        const bucket = getTaskBucketKey(projectId);
        const cached = nextTaskOrderByBucket.get(bucket);
        if (cached !== undefined) {
            nextTaskOrderByBucket.set(bucket, cached + 1);
            return cached;
        }
        const currentMax = nextData.tasks
            .filter((task) => !task.deletedAt && (task.projectId ?? undefined) === projectId && !task.areaId)
            .reduce((max, task) => {
                const candidate = typeof task.order === 'number'
                    ? task.order
                    : typeof task.orderNum === 'number'
                        ? task.orderNum
                        : -1;
                return Math.max(max, candidate);
            }, -1);
        const nextOrder = currentMax + 1;
        nextTaskOrderByBucket.set(bucket, nextOrder + 1);
        return nextOrder;
    };

    parsedData.tasks
        .slice()
        .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title))
        .forEach((parsedTask) => {
            const projectId = parsedTask.projectSourceKey ? projectIdBySourceKey.get(parsedTask.projectSourceKey) : undefined;
            const order = allocateTaskOrder(projectId);
            const task: Task = {
                id: uuidv4(),
                title: parsedTask.title,
                status: parsedTask.status,
                taskMode: 'task',
                priority: parsedTask.priority,
                contexts: parsedTask.contexts,
                tags: parsedTask.tags,
                description: parsedTask.description,
                startTime: parsedTask.startTime,
                dueDate: parsedTask.dueDate,
                completedAt: parsedTask.completedAt,
                pushCount: 0,
                createdAt: nowIso,
                updatedAt: nowIso,
                rev: 1,
                revBy: deviceState.deviceId,
                order,
                orderNum: order,
                ...(projectId ? { projectId } : {}),
            };
            nextData.tasks.push(task);
            importedTaskCount += 1;
            if (!projectId) {
                importedStandaloneTaskCount += 1;
            }
        });

    return {
        data: nextData,
        importedProjectCount,
        importedStandaloneTaskCount,
        importedTaskCount,
        warnings,
    };
};
