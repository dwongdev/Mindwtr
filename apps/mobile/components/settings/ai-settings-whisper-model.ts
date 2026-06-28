export type WhisperModelDescriptor = {
    id: string;
    fileName: string;
    label: string;
    minBytes?: number;
    sha256?: string;
    sizeBytes?: number;
};


export type WhisperModelDownloadFile = {
    uri: string;
    delete?: () => void;
};

export type WhisperModelNativeDownloadResult = {
    statusCode?: number;
    bytesWritten?: number;
};

export type WhisperModelNativeFs = {
    downloadFile: (options: {
        fromUrl: string;
        toFile: string;
        headers?: Record<string, string>;
        cacheable?: boolean;
        readTimeout?: number;
        backgroundTimeout?: number;
    }) => { promise: Promise<WhisperModelNativeDownloadResult> };
};

export type WhisperModelNativeHashFs = {
    hash: (path: string, algorithm: string) => Promise<string>;
};

type NativeModuleCandidate = Partial<WhisperModelNativeFs> & Partial<WhisperModelNativeHashFs>;

const isNativeModuleCandidate = (value: unknown): value is NativeModuleCandidate => (
    typeof value === 'object' && value !== null
);

const getNativeModuleCandidates = (value: unknown): NativeModuleCandidate[] => {
    const candidates: NativeModuleCandidate[] = [];
    if (isNativeModuleCandidate(value)) {
        candidates.push(value);
        const maybeDefault = (value as { default?: unknown }).default;
        if (isNativeModuleCandidate(maybeDefault)) {
            candidates.push(maybeDefault);
        }
    }
    return candidates;
};

const hasNativeDownloadFile = (candidate: NativeModuleCandidate): candidate is WhisperModelNativeFs => (
    typeof candidate.downloadFile === 'function'
);

const hasNativeHash = (candidate: NativeModuleCandidate): candidate is WhisperModelNativeHashFs => (
    typeof candidate.hash === 'function'
);

export const resolveWhisperNativeFsModule = (value: unknown): WhisperModelNativeFs | null => (
    getNativeModuleCandidates(value).find(hasNativeDownloadFile) ?? null
);

export const resolveWhisperNativeHashModule = (value: unknown): WhisperModelNativeHashFs | null => (
    getNativeModuleCandidates(value).find(hasNativeHash) ?? null
);

export type WhisperModelResolveDownloadUrl = (url: string) => Promise<string>;

export const resolveWhisperModelDownloadUrl = async (url: string, fetchImpl = globalThis.fetch): Promise<string> => {
    if (typeof fetchImpl !== 'function') return url;

    const resolveFromHead = async (redirect: RequestRedirect): Promise<string> => {
        const response = await fetchImpl(url, { method: 'HEAD', redirect });
        const location = response.headers?.get?.('location');
        if (location) return new URL(location, url).toString();
        const resolvedUrl = typeof response.url === 'string' && response.url.trim() ? response.url : '';
        return resolvedUrl && resolvedUrl !== url ? resolvedUrl : '';
    };

    try {
        const manualRedirectUrl = await resolveFromHead('manual');
        if (manualRedirectUrl) return manualRedirectUrl;
    } catch {
        // Some mobile fetch implementations do not support manual redirects for HEAD.
    }

    try {
        const followedUrl = await resolveFromHead('follow');
        if (followedUrl) return followedUrl;
    } catch {
        // Fall back to the original URL; the native downloader will surface any HTTP failure.
    }
    return url;
};

export type WhisperModelExpoDownloadFile<TFile extends WhisperModelDownloadFile> = (
    url: string,
    targetFile: TFile,
    options?: { idempotent?: boolean }
) => Promise<TFile>;

export const toWhisperNativeDownloadPath = (uri: string): string => {
    let nativePath = uri;
    if (uri.startsWith('file://')) {
        nativePath = uri.slice('file://'.length);
    } else if (uri.startsWith('file:/')) {
        nativePath = uri.replace(/^file:\//u, '/');
    }
    try {
        return decodeURI(nativePath);
    } catch {
        return nativePath;
    }
};

export const downloadWhisperModelFile = async <TFile extends WhisperModelDownloadFile>({
    url,
    targetFile,
    nativeFs,
    resolveDownloadUrl,
}: {
    url: string;
    targetFile: TFile;
    nativeFs?: WhisperModelNativeFs | null;
    resolveDownloadUrl?: WhisperModelResolveDownloadUrl;
    expoDownloadFile: WhisperModelExpoDownloadFile<TFile>;
}): Promise<TFile> => {
    const downloadFile = nativeFs?.downloadFile;
    if (typeof downloadFile !== 'function') {
        throw new Error('Native streaming Whisper model downloads are unavailable in this build.');
    }

    let downloadUrl = url;
    if (resolveDownloadUrl) {
        try {
            const resolvedUrl = await resolveDownloadUrl(url);
            if (resolvedUrl.trim()) downloadUrl = resolvedUrl;
        } catch {
            downloadUrl = url;
        }
    }

    try {
        const result = await downloadFile({
            fromUrl: downloadUrl,
            toFile: toWhisperNativeDownloadPath(targetFile.uri),
            headers: { Accept: 'application/octet-stream' },
            cacheable: false,
            readTimeout: 10 * 60 * 1000,
            backgroundTimeout: 30 * 60 * 1000,
        }).promise;
        const statusCode = result.statusCode;
        if (typeof statusCode !== 'number' || statusCode < 200 || statusCode >= 300) {
            throw new Error(`Whisper model download failed with HTTP ${statusCode ?? 'unknown'}`);
        }
        return targetFile;
    } catch (error) {
        targetFile.delete?.();
        throw error;
    }
};

export type WhisperModelPathInfo = {
    exists?: boolean;
    isDirectory?: boolean | null;
    size?: number | null;
};

const normalizeForCompare = (uri: string): string => uri.trim().replace(/\\/gu, '/').replace(/\/+$/u, '');

const basename = (uri: string): string => {
    const normalized = normalizeForCompare(uri);
    return normalized.split('/').pop() ?? '';
};

export const getWhisperModelMinimumBytes = (model: WhisperModelDescriptor): number => Math.max(1, model.minBytes ?? 1);

export const getWhisperModelExpectedBytes = (model: WhisperModelDescriptor): number | undefined => (
    typeof model.sizeBytes === 'number' && Number.isFinite(model.sizeBytes) && model.sizeBytes > 0
        ? model.sizeBytes
        : undefined
);

export const isWhisperModelFileReady = (
    model: WhisperModelDescriptor,
    info: WhisperModelPathInfo | null | undefined
): boolean => {
    if (!info?.exists || info.isDirectory !== false) return false;
    const size = info.size ?? 0;
    const expectedBytes = getWhisperModelExpectedBytes(model);
    if (expectedBytes !== undefined) return size === expectedBytes;
    return size >= getWhisperModelMinimumBytes(model);
};

export type WhisperModelHashFile = (uri: string) => Promise<string>;

export const verifyWhisperModelFileHash = async (
    model: WhisperModelDescriptor,
    uri: string,
    hashFile: WhisperModelHashFile
): Promise<void> => {
    const expected = model.sha256?.trim().toLowerCase();
    if (!expected) return;
    const actual = (await hashFile(uri)).trim().toLowerCase();
    if (actual !== expected) {
        throw new Error(`Whisper model SHA-256 mismatch for ${model.label}: expected ${expected}, got ${actual}`);
    }
};

export const isWhisperModelSafeDeleteTarget = ({
    uri,
    fileName,
    allowedUris,
}: {
    uri: string;
    fileName: string;
    allowedUris: string[];
}): boolean => {
    if (!uri || !fileName || basename(uri) !== fileName) return false;
    const normalizedUri = normalizeForCompare(uri);
    return allowedUris.some((allowedUri) => normalizeForCompare(allowedUri) === normalizedUri);
};
