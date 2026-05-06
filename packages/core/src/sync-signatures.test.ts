import { describe, expect, it } from 'vitest';
import { createSyncSignatureMemo, normalizeAreaForContentComparison, toComparableSignature } from './sync-signatures';
import type { Area } from './types';

const area = (updates: Partial<Area> = {}): Area => ({
    id: 'area-1',
    name: 'Work',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...updates,
});

describe('sync signatures', () => {
    it('normalizes area default color and ordering for content comparison', () => {
        const local = normalizeAreaForContentComparison(area({
            color: '#6B7280',
            order: 10,
            name: '  Work  ',
        }));
        const incoming = normalizeAreaForContentComparison(area({
            order: 1,
            name: 'Work',
        }));

        expect(toComparableSignature(local)).toBe(toComparableSignature(incoming));
    });

    it('reuses comparable signatures across cloned entity references with matching revision metadata', () => {
        const memo = createSyncSignatureMemo();
        const first = normalizeAreaForContentComparison(area({
            rev: 3,
            revBy: 'device-a',
        }));
        const clone = { ...first };

        expect(toComparableSignature(first, memo)).toBe(toComparableSignature(clone, memo));
        expect(memo.comparableByRevision.size).toBe(1);
    });

    it('does not reuse stable signatures when revision metadata advances', () => {
        const memo = createSyncSignatureMemo();
        const original = normalizeAreaForContentComparison(area({
            rev: 3,
            name: 'Work',
        }));
        const changed = normalizeAreaForContentComparison(area({
            rev: 3,
            updatedAt: '2026-01-01T00:01:00.000Z',
            name: 'Personal',
        }));

        expect(toComparableSignature(original, memo)).not.toBe(toComparableSignature(changed, memo));
        expect(memo.comparableByRevision.size).toBe(2);
    });

    it('validates stable cache entries before reusing matching revision metadata', () => {
        const memo = createSyncSignatureMemo();
        const original = normalizeAreaForContentComparison(area({
            rev: 3,
            name: 'Work',
        }));
        const changed = normalizeAreaForContentComparison(area({
            rev: 3,
            name: 'Personal',
        }));

        expect(toComparableSignature(original, memo)).not.toBe(toComparableSignature(changed, memo));
        expect(memo.comparableByRevision.size).toBe(1);
    });
});
