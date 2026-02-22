type DropboxApiErrorPayload = {
    error?: {
        '.tag'?: unknown;
        path?: { '.tag'?: unknown };
    };
};

export const parseDropboxMetadataRev = (raw: string | null): { rev: string | null } => {
    if (!raw) return { rev: null };
    try {
        const parsed = JSON.parse(raw) as { rev?: unknown };
        return { rev: typeof parsed.rev === 'string' ? parsed.rev : null };
    } catch {
        return { rev: null };
    }
};

export const parseDropboxApiErrorTag = async (
    response: { json: () => Promise<unknown> }
): Promise<string> => {
    try {
        const payload = await response.json() as DropboxApiErrorPayload;
        const top = payload?.error?.['.tag'];
        if (typeof top !== 'string') return '';
        if (top === 'path') {
            const nested = payload?.error?.path?.['.tag'];
            if (typeof nested === 'string') return `path/${nested}`;
        }
        return top;
    } catch {
        return '';
    }
};

export const isDropboxPathConflictTag = (tag: string): boolean =>
    tag === 'path' || tag === 'path/conflict';

export const resolveDropboxPath = (path: string): string => {
    const trimmed = path.trim();
    if (!trimmed) throw new Error('Dropbox path is required');
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};
