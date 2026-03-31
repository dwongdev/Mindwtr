import {
    normalizeObsidianRelativePath,
    parseObsidianTasksFromMarkdown,
    type ObsidianTask,
} from '@mindwtr/core';

export type ObsidianConfig = {
    vaultPath: string | null;
    vaultName: string;
    scanFolders: string[];
    inboxFile: string;
    lastScannedAt: string | null;
    enabled: boolean;
};

export type ObsidianScanResult = {
    tasks: ObsidianTask[];
    scannedFileCount: number;
    scannedRelativePaths: string[];
    warnings: string[];
};

export type ObsidianFileScanResult = {
    tasks: ObsidianTask[];
    warning: string | null;
    isTracked: boolean;
    relativeFilePath: string;
};

type ScannerDirEntry = {
    name?: string;
    path?: string;
    isFile?: boolean;
    isDirectory?: boolean;
};

type ScannerFileInfo = {
    mtime: Date | null;
    size?: number;
    isFile?: boolean;
    isDirectory?: boolean;
};

export type ObsidianScannerDependencies = {
    exists: (path: string) => Promise<boolean>;
    readDir: (path: string) => Promise<ScannerDirEntry[]>;
    readTextFile: (path: string) => Promise<string>;
    stat: (path: string) => Promise<ScannerFileInfo>;
};

const DEFAULT_SCAN_FOLDERS = ['/'];
export const DEFAULT_OBSIDIAN_INBOX_FILE = 'Mindwtr/Inbox.md';
export const MAX_OBSIDIAN_MARKDOWN_BYTES = 5 * 1024 * 1024;
export const MAX_OBSIDIAN_SCAN_WARNINGS = 100;
const MAX_OBSIDIAN_SCAN_DEPTH = 32;

const basename = (input: string): string => {
    const normalized = input.replace(/[\\/]+$/, '');
    const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
};

const joinPath = (...parts: string[]): string => {
    const filtered = parts.filter(Boolean);
    if (filtered.length === 0) return '';

    const [first, ...rest] = filtered;
    const normalizedFirst = first.replace(/[\\/]+$/, '');
    const suffix = rest
        .map((part) => part.replace(/^[\\/]+/, '').replace(/[\\/]+$/, ''))
        .filter(Boolean)
        .join('/');
    if (!suffix) return normalizedFirst;
    return `${normalizedFirst}/${suffix}`;
};

const shouldSkipEntry = (name: string): boolean => {
    if (!name) return true;
    if (name === '.obsidian' || name === '.trash' || name === 'node_modules') return true;
    if (name.startsWith('.')) return true;
    return false;
};

const shouldSkipRelativePath = (relativePath: string): boolean => {
    try {
        const segments = normalizeObsidianRelativePath(relativePath)
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean);
        return segments.some(shouldSkipEntry);
    } catch {
        return true;
    }
};

const normalizeFilesystemPath = (value: string): string => {
    return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
};

const isPathWithinVault = (vaultPath: string, candidatePath: string): boolean => {
    const base = normalizeFilesystemPath(vaultPath);
    const candidate = normalizeFilesystemPath(candidatePath);
    return candidate === base || candidate.startsWith(`${base}/`);
};

const pushWarning = (warnings: string[], message: string): void => {
    if (warnings.length >= MAX_OBSIDIAN_SCAN_WARNINGS) return;
    warnings.push(message);
};

const safeNormalizeRelativePath = (value: string): string => {
    try {
        return normalizeObsidianRelativePath(value);
    } catch {
        return String(value || '').trim();
    }
};

export const deriveVaultName = (vaultPath: string | null | undefined): string => {
    const trimmed = String(vaultPath || '').trim();
    if (!trimmed) return '';
    return basename(trimmed);
};

const sanitizeScanFolder = (value: string): string => {
    const trimmed = String(value || '').trim().replace(/\\/g, '/');
    if (!trimmed || trimmed === '/') return '/';

    const segments = trimmed
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .reduce<string[]>((acc, segment) => {
            if (segment === '.') return acc;
            if (segment === '..') {
                acc.pop();
                return acc;
            }
            acc.push(segment);
            return acc;
        }, []);

    return segments.length > 0 ? segments.join('/') : '/';
};

export const sanitizeObsidianInboxFile = (value: string | null | undefined): string => {
    try {
        const normalized = normalizeObsidianRelativePath(String(value || '').trim());
        return normalized || DEFAULT_OBSIDIAN_INBOX_FILE;
    } catch {
        return DEFAULT_OBSIDIAN_INBOX_FILE;
    }
};

export const sanitizeScanFolders = (folders: string[] | null | undefined): string[] => {
    const source = Array.isArray(folders) ? folders : DEFAULT_SCAN_FOLDERS;
    const sanitized = source.map(sanitizeScanFolder);
    const unique = Array.from(new Set(sanitized.filter(Boolean)));
    return unique.length > 0 ? unique : [...DEFAULT_SCAN_FOLDERS];
};

export const normalizeObsidianConfig = (config: Partial<ObsidianConfig> | null | undefined): ObsidianConfig => {
    const vaultPath = String(config?.vaultPath || '').trim() || null;
    const scanFolders = sanitizeScanFolders(config?.scanFolders);
    const lastScannedAt = String(config?.lastScannedAt || '').trim() || null;
    const enabled = vaultPath ? config?.enabled !== false : false;

    return {
        vaultPath,
        vaultName: deriveVaultName(vaultPath),
        scanFolders,
        inboxFile: sanitizeObsidianInboxFile(config?.inboxFile),
        lastScannedAt,
        enabled,
    };
};

export const resolveObsidianAbsolutePath = (vaultPath: string, relativeFilePath: string): string => {
    const trimmedVaultPath = String(vaultPath || '').trim();
    if (!trimmedVaultPath) {
        throw new Error('Obsidian vault path is not configured.');
    }
    const normalizedRelativePath = normalizeObsidianRelativePath(relativeFilePath);
    if (!normalizedRelativePath) {
        throw new Error('Obsidian file path is not configured.');
    }
    return joinPath(trimmedVaultPath, normalizedRelativePath);
};

export const isObsidianFileInScanFolders = (
    relativeFilePath: string,
    folders: string[] | null | undefined
): boolean => {
    let normalizedRelativePath: string;
    try {
        normalizedRelativePath = normalizeObsidianRelativePath(relativeFilePath);
    } catch {
        return false;
    }
    if (!normalizedRelativePath) return false;
    if (!normalizedRelativePath.toLowerCase().endsWith('.md')) return false;
    if (shouldSkipRelativePath(normalizedRelativePath)) return false;

    return sanitizeScanFolders(folders).some((scanFolder) => {
        if (scanFolder === '/') return true;
        let normalizedScanFolder: string;
        try {
            normalizedScanFolder = normalizeObsidianRelativePath(scanFolder);
        } catch {
            return false;
        }
        if (!normalizedScanFolder) return false;
        if (shouldSkipRelativePath(normalizedScanFolder)) return false;
        if (normalizedScanFolder.toLowerCase().endsWith('.md')) {
            return normalizedRelativePath === normalizedScanFolder;
        }
        return normalizedRelativePath === normalizedScanFolder
            || normalizedRelativePath.startsWith(`${normalizedScanFolder}/`);
    });
};

export const sortObsidianTasks = (tasks: ObsidianTask[]): ObsidianTask[] => {
    return [...tasks].sort((left, right) => {
        const pathCompare = left.source.relativeFilePath.localeCompare(right.source.relativeFilePath);
        if (pathCompare !== 0) return pathCompare;
        return left.source.lineNumber - right.source.lineNumber;
    });
};

const readAndParseObsidianMarkdownFile = async (
    rawConfig: Partial<ObsidianConfig> | null | undefined,
    absolutePath: string,
    relativePath: string,
    deps: Pick<ObsidianScannerDependencies, 'exists' | 'readTextFile' | 'stat'>
): Promise<ObsidianFileScanResult> => {
    const config = normalizeObsidianConfig(rawConfig);
    const vaultPath = config.vaultPath;
    if (!config.enabled || !vaultPath) {
        return {
            tasks: [],
            warning: null,
            isTracked: false,
            relativeFilePath: safeNormalizeRelativePath(relativePath),
        };
    }

    let normalizedRelativePath: string;
    try {
        normalizedRelativePath = normalizeObsidianRelativePath(relativePath);
    } catch (error) {
        return {
            tasks: [],
            warning:
                error instanceof Error && error.message.trim()
                    ? error.message
                    : `Skipped invalid Obsidian path: ${relativePath}`,
            isTracked: false,
            relativeFilePath: String(relativePath || '').trim(),
        };
    }

    if (!normalizedRelativePath.toLowerCase().endsWith('.md')) {
        return {
            tasks: [],
            warning: null,
            isTracked: false,
            relativeFilePath: normalizedRelativePath,
        };
    }
    if (shouldSkipRelativePath(normalizedRelativePath)) {
        return {
            tasks: [],
            warning: null,
            isTracked: false,
            relativeFilePath: normalizedRelativePath,
        };
    }
    if (!isPathWithinVault(vaultPath, absolutePath)) {
        return {
            tasks: [],
            warning: `Skipped file outside the configured vault: ${normalizedRelativePath}`,
            isTracked: false,
            relativeFilePath: normalizedRelativePath,
        };
    }
    if (!(await deps.exists(absolutePath))) {
        return {
            tasks: [],
            warning: null,
            isTracked: false,
            relativeFilePath: normalizedRelativePath,
        };
    }

    const fileInfo = await deps.stat(absolutePath);
    if (fileInfo.isDirectory) {
        return {
            tasks: [],
            warning: null,
            isTracked: false,
            relativeFilePath: normalizedRelativePath,
        };
    }
    if ((fileInfo.size ?? 0) > MAX_OBSIDIAN_MARKDOWN_BYTES) {
        return {
            tasks: [],
            warning: `Skipped large Markdown file: ${normalizedRelativePath}`,
            isTracked: false,
            relativeFilePath: normalizedRelativePath,
        };
    }

    const markdown = await deps.readTextFile(absolutePath);
    const fileModifiedAt = fileInfo.mtime?.toISOString() ?? new Date(0).toISOString();
    const parsed = parseObsidianTasksFromMarkdown(markdown, {
        vaultName: config.vaultName,
        vaultPath,
        relativeFilePath: normalizedRelativePath,
        fileModifiedAt,
    });
    return {
        tasks: parsed.tasks,
        warning: null,
        isTracked: true,
        relativeFilePath: normalizedRelativePath,
    };
};

export async function scanObsidianFile(
    rawConfig: Partial<ObsidianConfig> | null | undefined,
    relativeFilePath: string,
    deps: Pick<ObsidianScannerDependencies, 'exists' | 'readTextFile' | 'stat'>
): Promise<ObsidianFileScanResult> {
    const config = normalizeObsidianConfig(rawConfig);
    const vaultPath = config.vaultPath;
    if (!config.enabled || !vaultPath) {
        return {
            tasks: [],
            warning: null,
            isTracked: false,
            relativeFilePath: safeNormalizeRelativePath(relativeFilePath),
        };
    }
    const absolutePath = resolveObsidianAbsolutePath(vaultPath, relativeFilePath);
    return readAndParseObsidianMarkdownFile(config, absolutePath, relativeFilePath, deps);
}

export async function scanObsidianVault(
    rawConfig: Partial<ObsidianConfig> | null | undefined,
    deps: ObsidianScannerDependencies
): Promise<ObsidianScanResult> {
    const config = normalizeObsidianConfig(rawConfig);
    const vaultPath = config.vaultPath;
    if (!config.enabled || !vaultPath) {
        return { tasks: [], scannedFileCount: 0, scannedRelativePaths: [], warnings: [] };
    }

    const tasks: ObsidianTask[] = [];
    const warnings: string[] = [];
    const seenFiles = new Set<string>();
    const visitedDirectories = new Set<string>();
    const scannedRelativePaths: string[] = [];
    let scannedFileCount = 0;

    const scanMarkdownFile = async (absolutePath: string, relativePath: string): Promise<void> => {
        const fileResult = await readAndParseObsidianMarkdownFile(config, absolutePath, relativePath, deps);
        const { relativeFilePath: normalizedRelativePath } = fileResult;
        if (!normalizedRelativePath) return;
        if (seenFiles.has(normalizedRelativePath)) return;
        if (fileResult.warning) {
            pushWarning(warnings, fileResult.warning);
            return;
        }
        if (!fileResult.isTracked) {
            return;
        }

        seenFiles.add(normalizedRelativePath);
        scannedFileCount += 1;
        scannedRelativePaths.push(normalizedRelativePath);
        tasks.push(...fileResult.tasks);
    };

    const walkDirectory = async (absoluteDirPath: string, relativeDirPath: string, depth: number): Promise<void> => {
        if (depth > MAX_OBSIDIAN_SCAN_DEPTH) {
            pushWarning(warnings, `Skipped deeply nested Obsidian folder: ${relativeDirPath || '/'}`);
            return;
        }
        if (!isPathWithinVault(vaultPath, absoluteDirPath)) {
            pushWarning(warnings, `Skipped folder outside the configured vault: ${relativeDirPath || '/'}`);
            return;
        }

        const normalizedDirPath = normalizeFilesystemPath(absoluteDirPath);
        if (visitedDirectories.has(normalizedDirPath)) return;
        visitedDirectories.add(normalizedDirPath);

        const entries = await deps.readDir(absoluteDirPath);
        for (const entry of entries) {
            const name = String(entry.name || basename(String(entry.path || ''))).trim();
            if (!name || shouldSkipEntry(name)) continue;

            const absolutePath = String(entry.path || joinPath(absoluteDirPath, name));
            let relativePath: string;
            try {
                relativePath = normalizeObsidianRelativePath(relativeDirPath ? `${relativeDirPath}/${name}` : name);
            } catch {
                pushWarning(warnings, `Skipped invalid Obsidian path: ${relativeDirPath ? `${relativeDirPath}/${name}` : name}`);
                continue;
            }

            if (entry.isDirectory) {
                await walkDirectory(absolutePath, relativePath, depth + 1);
                continue;
            }

            if (!entry.isFile) continue;
            await scanMarkdownFile(absolutePath, relativePath);
        }
    };

    for (const scanFolder of config.scanFolders) {
        if (scanFolder !== '/' && shouldSkipRelativePath(scanFolder)) {
            pushWarning(warnings, `Skipped invalid scan folder: ${scanFolder}`);
            continue;
        }

        const normalizedScanFolder = scanFolder === '/' ? '' : normalizeObsidianRelativePath(scanFolder);
        const absolutePath = normalizedScanFolder ? joinPath(vaultPath, normalizedScanFolder) : vaultPath;
        if (!isPathWithinVault(vaultPath, absolutePath)) {
            pushWarning(warnings, `Skipped scan folder outside the configured vault: ${scanFolder}`);
            continue;
        }
        if (!(await deps.exists(absolutePath))) continue;
        const fileInfo = await deps.stat(absolutePath);
        if (fileInfo.isFile && absolutePath.toLowerCase().endsWith('.md')) {
            await scanMarkdownFile(absolutePath, normalizedScanFolder);
            continue;
        }
        await walkDirectory(absolutePath, normalizedScanFolder, 0);
    }

    return {
        tasks: sortObsidianTasks(tasks),
        scannedFileCount,
        scannedRelativePaths: [...scannedRelativePaths].sort((left, right) => left.localeCompare(right)),
        warnings,
    };
}
