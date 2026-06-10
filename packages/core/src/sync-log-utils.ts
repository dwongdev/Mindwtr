import type { PendingAttachmentUpload } from './sync-helpers';
import type { MergeStats } from './sync-types';

type SanitizeLogValue = (value: string) => string;

const identitySanitizer: SanitizeLogValue = (value) => value;

export const buildPendingAttachmentUploadLogExtra = (
    backend: string,
    phase: string,
    pending: PendingAttachmentUpload[],
    sanitizeLogValue: SanitizeLogValue = identitySanitizer,
): Record<string, string> => {
    const sample = pending.slice(0, 3);
    return {
        backend,
        phase,
        pending: String(pending.length),
        sample: sample.map((item) => `${item.ownerType}:${item.ownerId}:${item.attachmentId}`).join(', '),
        uriSchemes: sample.map((item) => item.uriScheme || 'unknown').join(', '),
        localStatuses: sample.map((item) => item.localStatus || 'unset').join(', '),
        titles: sample.map((item) => sanitizeLogValue(item.title || '')).join(' | '),
    };
};

export const buildConflictDiagnosticsLogExtra = (stats: MergeStats): Record<string, string> => {
    const reasonCountsByEntity = Object.fromEntries(
        Object.entries({
            tasks: stats.tasks.conflictReasonCounts ?? {},
            projects: stats.projects.conflictReasonCounts ?? {},
            sections: stats.sections.conflictReasonCounts ?? {},
            areas: stats.areas.conflictReasonCounts ?? {},
        }).filter(([, counts]) => Object.keys(counts).length > 0)
    );
    const conflictSamples = [
        ...(stats.tasks.conflictSamples ?? []).map((sample) => ({ entity: 'task', ...sample })),
        ...(stats.projects.conflictSamples ?? []).map((sample) => ({ entity: 'project', ...sample })),
        ...(stats.sections.conflictSamples ?? []).map((sample) => ({ entity: 'section', ...sample })),
        ...(stats.areas.conflictSamples ?? []).map((sample) => ({ entity: 'area', ...sample })),
    ].slice(0, 6);
    const extra: Record<string, string> = {};
    if (Object.keys(reasonCountsByEntity).length > 0) {
        extra.conflictReasonCounts = JSON.stringify(reasonCountsByEntity);
    }
    if (conflictSamples.length > 0) {
        extra.conflictSamples = JSON.stringify(conflictSamples);
    }
    return extra;
};
