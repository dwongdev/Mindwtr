import type { AppData, Attachment, PendingRemoteAttachmentDelete } from './types';

export interface CleanupResult {
    orphanedCount: number;
    cleanedIds: string[];
    errors: Array<{ id: string; error: string }>;
}

export function findOrphanedAttachments(appData: AppData): Attachment[] {
    const allAttachments = new Map<string, Attachment>();
    const activeReferenceIds = new Set<string>();

    for (const task of appData.tasks) {
        const taskPurged = Boolean(task.purgedAt);
        for (const attachment of task.attachments || []) {
            allAttachments.set(attachment.id, attachment);
            if (!taskPurged && !attachment.deletedAt) {
                activeReferenceIds.add(attachment.id);
            }
        }
    }

    for (const project of appData.projects) {
        const projectDeleted = Boolean(project.deletedAt);
        for (const attachment of project.attachments || []) {
            allAttachments.set(attachment.id, attachment);
            if (!projectDeleted && !attachment.deletedAt) {
                activeReferenceIds.add(attachment.id);
            }
        }
    }

    return Array.from(allAttachments.values()).filter((attachment) => !activeReferenceIds.has(attachment.id));
}

export function findDeletedAttachmentsForFileCleanup(appData: AppData): Attachment[] {
    const deleted = new Map<string, Attachment>();

    for (const task of appData.tasks) {
        for (const attachment of task.attachments || []) {
            if (!attachment.deletedAt) continue;
            deleted.set(attachment.id, attachment);
        }
    }

    for (const project of appData.projects) {
        for (const attachment of project.attachments || []) {
            if (!attachment.deletedAt) continue;
            deleted.set(attachment.id, attachment);
        }
    }

    return Array.from(deleted.values());
}

export type LiveAttachmentResourceReferences = {
    localUris: ReadonlySet<string>;
    cloudKeys: ReadonlySet<string>;
};

export function normalizeAttachmentCleanupUri(uri?: string): string | undefined {
    if (!uri) return undefined;
    if (/^https?:\/\//i.test(uri) || uri.startsWith('content://')) return undefined;
    return uri.replace(/^file:\/\//i, '');
}

export function findLiveAttachmentResourceReferences(appData: AppData): LiveAttachmentResourceReferences {
    const localUris = new Set<string>();
    const cloudKeys = new Set<string>();

    const collect = (attachments: readonly Attachment[] | undefined, parentDeleted: boolean) => {
        if (parentDeleted) return;
        for (const attachment of attachments || []) {
            if (attachment.deletedAt) continue;
            const localUri = normalizeAttachmentCleanupUri(attachment.uri);
            if (localUri) localUris.add(localUri);
            if (attachment.cloudKey) cloudKeys.add(attachment.cloudKey);
        }
    };

    for (const task of appData.tasks) {
        collect(task.attachments, Boolean(task.deletedAt));
    }

    for (const project of appData.projects) {
        collect(project.attachments, Boolean(project.deletedAt));
    }

    return { localUris, cloudKeys };
}

export function isAttachmentLocalResourceReferenced(
    attachment: Attachment,
    references: LiveAttachmentResourceReferences,
): boolean {
    const localUri = normalizeAttachmentCleanupUri(attachment.uri);
    return Boolean(localUri && references.localUris.has(localUri));
}

export function isAttachmentCloudResourceReferenced(
    attachment: Pick<Attachment, 'cloudKey'>,
    references: LiveAttachmentResourceReferences,
): boolean {
    return Boolean(attachment.cloudKey && references.cloudKeys.has(attachment.cloudKey));
}

export function removeOrphanedAttachmentsFromData(appData: AppData): AppData {
    const orphanedIds = new Set(findOrphanedAttachments(appData).map((attachment) => attachment.id));

    if (orphanedIds.size === 0) return appData;

    return {
        ...appData,
        tasks: appData.tasks.map((task) => ({
            ...task,
            attachments: task.attachments?.filter((attachment) => !orphanedIds.has(attachment.id)),
        })),
        projects: appData.projects.map((project) => ({
            ...project,
            attachments: project.attachments?.filter((attachment) => !orphanedIds.has(attachment.id)),
        })),
    };
}

export function removeAttachmentsByIdFromData(appData: AppData, attachmentIds: Iterable<string>): AppData {
    const ids = new Set(attachmentIds);
    if (ids.size === 0) return appData;

    return {
        ...appData,
        tasks: appData.tasks.map((task) => ({
            ...task,
            attachments: task.attachments?.filter((attachment) => !ids.has(attachment.id)),
        })),
        projects: appData.projects.map((project) => ({
            ...project,
            attachments: project.attachments?.filter((attachment) => !ids.has(attachment.id)),
        })),
    };
}

export type AttachmentCleanupApplyResult = {
    lastCleanupAt: string;
    pendingRemoteDeletes?: readonly PendingRemoteAttachmentDelete[];
    orphanedAttachments?: readonly Attachment[];
    processedOrphanedIds?: Iterable<string>;
    reachedBatchLimit?: boolean;
};

export function applyAttachmentCleanupResult(appData: AppData, result: AttachmentCleanupApplyResult): AppData {
    const hasOrphaned = (result.orphanedAttachments?.length ?? 0) > 0;
    const cleaned = hasOrphaned
        ? result.reachedBatchLimit
            ? removeAttachmentsByIdFromData(appData, result.processedOrphanedIds ?? [])
            : removeOrphanedAttachmentsFromData(appData)
        : appData;
    const pendingRemoteDeletes = result.pendingRemoteDeletes?.length
        ? [...result.pendingRemoteDeletes]
        : undefined;

    return {
        ...cleaned,
        settings: {
            ...cleaned.settings,
            attachments: {
                ...cleaned.settings.attachments,
                lastCleanupAt: result.lastCleanupAt,
                pendingRemoteDeletes,
            },
        },
    };
}
