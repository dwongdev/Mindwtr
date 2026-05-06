import { describe, expect, it, vi } from 'vitest';
import { MAX_SYNC_REVISION, nextRevision, normalizeRevision } from './sync-revision';

describe('sync revision helpers', () => {
    it('increments revisions up to the safe maximum', () => {
        expect(nextRevision(undefined)).toBe(1);
        expect(nextRevision(MAX_SYNC_REVISION - 1)).toBe(MAX_SYNC_REVISION);
    });

    it('preserves the cap and warns instead of overflowing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            expect(nextRevision(MAX_SYNC_REVISION)).toBe(MAX_SYNC_REVISION);
            expect(warnSpy.mock.calls.some(([message]) => (
                message === 'Sync revision reached safe maximum; preserving capped revision'
            ))).toBe(true);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('clamps oversized revisions during normalization', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            expect(normalizeRevision(MAX_SYNC_REVISION + 100)).toBe(MAX_SYNC_REVISION);
            expect(warnSpy.mock.calls.some(([message]) => (
                message === 'Clamped sync revision above safe maximum'
            ))).toBe(true);
        } finally {
            warnSpy.mockRestore();
        }
    });
});
