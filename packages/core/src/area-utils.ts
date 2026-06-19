import type { AppSettings, Area } from './types';
import { nextRevision } from './sync-revision';

export const normalizeAreaNameKey = (name: unknown): string => (
    typeof name === 'string' ? name.trim().toLowerCase() : ''
);

export const resolveDefaultNewTaskAreaId = (
    settings: AppSettings | undefined,
    areas: readonly Area[]
): string | undefined => {
    const configuredAreaId = settings?.gtd?.defaultAreaId;
    if (typeof configuredAreaId !== 'string') return undefined;
    const areaId = configuredAreaId.trim();
    if (!areaId) return undefined;
    return areas.some((area) => area.id === areaId && !area.deletedAt) ? areaId : undefined;
};

export const dedupeLiveAreasByName = (
    areas: readonly Area[],
    options: { nowIso: string; revBy?: string }
): { areas: Area[]; areaIdRemap: Map<string, string>; changed: boolean } => {
    const areaIdByName = new Map<string, string>();
    const areaIdRemap = new Map<string, string>();
    let changed = false;

    const nextAreas = areas.map((area) => {
        if (area.deletedAt) return area;
        const nameKey = normalizeAreaNameKey(area.name);
        if (!nameKey) return area;

        const existingId = areaIdByName.get(nameKey);
        if (!existingId) {
            areaIdByName.set(nameKey, area.id);
            return area;
        }

        changed = true;
        areaIdRemap.set(area.id, existingId);
        return {
            ...area,
            deletedAt: options.nowIso,
            updatedAt: options.nowIso,
            rev: nextRevision(area.rev),
            ...(options.revBy ? { revBy: options.revBy } : {}),
        };
    });

    return { areas: nextAreas, areaIdRemap, changed };
};
